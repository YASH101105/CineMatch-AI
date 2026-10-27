package com.cinematch.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.cinematch.backend.entity.Favorite;

public interface FavoriteRepository extends JpaRepository<Favorite, Long> {
    List<Favorite> findAllByUser_IdOrderByCreatedAtDesc(Long userId);
    Optional<Favorite> findByUser_IdAndTmdbMovieId(Long userId, Long tmdbMovieId);
    void deleteByUser_IdAndTmdbMovieId(Long userId, Long tmdbMovieId);
}
