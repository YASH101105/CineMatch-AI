package com.cinematch.backend.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.cinematch.backend.entity.UserAccount;
import com.cinematch.backend.entity.UserRating;
import com.cinematch.backend.repository.UserAccountRepository;
import com.cinematch.backend.repository.UserRatingRepository;

@RestController
@RequestMapping("/api/ratings")
public class RatingController {

    private final UserRatingRepository ratings;
    private final UserAccountRepository users;

    public RatingController(
            UserRatingRepository ratings,
            UserAccountRepository users) {
        this.ratings = ratings;
        this.users = users;
    }

    @GetMapping("/movie/{movieId}")
    @Transactional(readOnly = true)
    public RatingSummary getMovieRating(
            @PathVariable Long movieId,
            Authentication authentication) {
        validateMovieId(movieId);
        Long userId = authenticatedUserId(authentication);
        Integer userRating = userId == null
                ? null
                : ratings.findByUser_IdAndTmdbMovieId(userId, movieId)
                        .map(UserRating::getScore)
                        .orElse(null);
        Double average = ratings.averageScoreForMovie(movieId);

        return new RatingSummary(
                movieId,
                average == null ? 0.0 : Math.round(average * 10.0) / 10.0,
                ratings.countByTmdbMovieId(movieId),
                userRating);
    }

    @PostMapping
    @Transactional
    public RatingSummary saveRating(
            @Valid @RequestBody SaveRatingRequest request,
            Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in to rate movies.");
        }

        UserAccount account = users.findByEmailIgnoreCase(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Sign in to rate movies."));
        UserRating rating = ratings.findByUser_IdAndTmdbMovieId(
                        account.getId(), request.movieId())
                .orElseGet(UserRating::new);

        rating.setUser(account);
        rating.setTmdbMovieId(request.movieId());
        rating.setMovieTitle(request.movieTitle().trim());
        rating.setScore(request.score());
        ratings.save(rating);

        Double average = ratings.averageScoreForMovie(request.movieId());
        return new RatingSummary(
                request.movieId(),
                average == null ? 0.0 : Math.round(average * 10.0) / 10.0,
                ratings.countByTmdbMovieId(request.movieId()),
                request.score());
    }

    private Long authenticatedUserId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            return null;
        }
        return users.findByEmailIgnoreCase(authentication.getName())
                .map(UserAccount::getId)
                .orElse(null);
    }

    private static void validateMovieId(Long movieId) {
        if (movieId == null || movieId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid movie ID.");
        }
    }

    public record SaveRatingRequest(
            @NotNull @Positive Long movieId,
            @NotBlank @Size(max = 250) String movieTitle,
            @NotNull @Min(1) @Max(5) Integer score) {}

    public record RatingSummary(
            Long movieId,
            Double averageRating,
            long ratingCount,
            Integer userRating) {}
}
