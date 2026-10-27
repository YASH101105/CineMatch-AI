package com.cinematch.backend.controller;

import java.time.LocalDateTime;
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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.cinematch.backend.entity.MovieComment;
import com.cinematch.backend.entity.UserAccount;
import com.cinematch.backend.repository.MovieCommentRepository;
import com.cinematch.backend.repository.UserAccountRepository;

@RestController
@RequestMapping("/api/comments")
public class CommentController {

    private final MovieCommentRepository comments;
    private final UserAccountRepository users;

    public CommentController(MovieCommentRepository comments, UserAccountRepository users) {
        this.comments = comments;
        this.users = users;
    }

    @GetMapping("/movie/{movieId}")
    @Transactional(readOnly = true)
    public List<CommentResponse> getMovieComments(@PathVariable Long movieId) {
        validateMovieId(movieId);
        return comments.findAllByTmdbMovieIdOrderByCreatedAtDesc(movieId)
                .stream()
                .map(CommentController::toResponse)
                .toList();
    }

    @PostMapping
    @Transactional
    public CommentResponse addComment(
            @Valid @RequestBody CommentRequest request,
            Authentication authentication) {
        validateMovieId(request.movieId());
        UserAccount user = requireUser(authentication);

        MovieComment comment = new MovieComment();
        comment.setUser(user);
        comment.setTmdbMovieId(request.movieId());
        comment.setMovieTitle(request.movieTitle().trim());
        comment.setContent(request.content().trim());
        return toResponse(comments.save(comment));
    }

    private void validateMovieId(Long movieId) {
        if (movieId == null || movieId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid movie ID.");
        }
    }

    private UserAccount requireUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in to post a comment.");
        }
        return users.findByEmailIgnoreCase(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Sign in to post a comment."));
    }

    private static CommentResponse toResponse(MovieComment comment) {
        return new CommentResponse(
                comment.getId(),
                comment.getUser().getDisplayName(),
                comment.getContent(),
                comment.getCreatedAt());
    }

    public record CommentRequest(
            @NotNull @Positive Long movieId,
            @NotBlank @Size(max = 250) String movieTitle,
            @NotBlank @Size(max = 1000) String content) {}

    public record CommentResponse(
            Long id,
            String displayName,
            String content,
            LocalDateTime createdAt) {}
}
