package com.cinematch.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.cinematch.backend.entity.MovieComment;

public interface MovieCommentRepository extends JpaRepository<MovieComment, Long> {
    List<MovieComment> findAllByTmdbMovieIdOrderByCreatedAtDesc(Long tmdbMovieId);
}
