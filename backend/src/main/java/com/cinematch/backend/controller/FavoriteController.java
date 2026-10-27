package com.cinematch.backend.controller;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.cinematch.backend.entity.Favorite;
import com.cinematch.backend.entity.UserAccount;
import com.cinematch.backend.repository.FavoriteRepository;
import com.cinematch.backend.repository.UserAccountRepository;

@RestController
@RequestMapping("/api/favorites")
public class FavoriteController {

    private final FavoriteRepository favorites;
    private final UserAccountRepository users;

    public FavoriteController(FavoriteRepository favorites, UserAccountRepository users) {
        this.favorites = favorites;
        this.users = users;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<FavoriteResponse> getFavorites(Authentication authentication) {
        UserAccount user = requireUser(authentication);
        return favorites.findAllByUser_IdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(FavoriteController::toResponse)
                .toList();
    }

    @PostMapping
    @Transactional
    public FavoriteResponse addFavorite(
            @Valid @RequestBody FavoriteRequest request,
            Authentication authentication) {
        UserAccount user = requireUser(authentication);
        Favorite favorite = favorites.findByUser_IdAndTmdbMovieId(user.getId(), request.movieId())
                .orElseGet(Favorite::new);
        favorite.setUser(user);
        favorite.setTmdbMovieId(request.movieId());
        favorite.setMovieTitle(request.movieTitle().trim());
        favorite.setPosterPath(request.posterPath());
        favorite.setBackdropPath(request.backdropPath());
        favorite.setReleaseDate(request.releaseDate());
        favorite.setVoteAverage(request.voteAverage());
        return toResponse(favorites.save(favorite));
    }

    @DeleteMapping("/{movieId}")
    @Transactional
    public void removeFavorite(
            @PathVariable Long movieId,
            Authentication authentication) {
        if (movieId == null || movieId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid movie ID.");
        }
        UserAccount user = requireUser(authentication);
        favorites.deleteByUser_IdAndTmdbMovieId(user.getId(), movieId);
    }

    private UserAccount requireUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in to use favourites.");
        }
        return users.findByEmailIgnoreCase(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Sign in to use favourites."));
    }

    private static FavoriteResponse toResponse(Favorite favorite) {
        return new FavoriteResponse(
                favorite.getTmdbMovieId(),
                favorite.getMovieTitle(),
                favorite.getPosterPath(),
                favorite.getBackdropPath(),
                favorite.getReleaseDate(),
                favorite.getVoteAverage());
    }

    public record FavoriteRequest(
            @NotNull @Positive Long movieId,
            @NotBlank @Size(max = 250) String movieTitle,
            @Size(max = 255) String posterPath,
            @Size(max = 255) String backdropPath,
            @Size(max = 20) String releaseDate,
            Double voteAverage) {}

    public record FavoriteResponse(
            Long movieId,
            String movieTitle,
            String posterPath,
            String backdropPath,
            String releaseDate,
            Double voteAverage) {}
}
