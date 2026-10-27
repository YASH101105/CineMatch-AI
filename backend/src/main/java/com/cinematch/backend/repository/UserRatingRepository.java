package com.cinematch.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.cinematch.backend.entity.UserRating;

public interface UserRatingRepository extends JpaRepository<UserRating, Long> {
    Optional<UserRating> findByUser_IdAndTmdbMovieId(Long userId, Long tmdbMovieId);
    long countByTmdbMovieId(Long tmdbMovieId);

    @Query("select avg(r.score) from UserRating r where r.tmdbMovieId = :movieId")
    Double averageScoreForMovie(@Param("movieId") Long movieId);
}
