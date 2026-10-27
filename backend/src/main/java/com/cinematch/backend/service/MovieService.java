
package com.cinematch.backend.service;


import com.cinematch.backend.entity.Movie;
import com.cinematch.backend.exception.ResourceNotFoundException;
import com.cinematch.backend.repository.MovieRepository;
import org.springframework.stereotype.Service;



import java.util.List;

@Service
public class MovieService {

    private final MovieRepository movieRepository;

    public MovieService(MovieRepository movieRepository) {
        this.movieRepository = movieRepository;
    }

    public List<Movie> getAllMovies() {
        return movieRepository.findAll();
    }

    public Movie saveMovie(Movie movie) {
        return movieRepository.save(movie);
    }
    public Movie getMovieById(Long id) {
    return movieRepository.findById(id)
            .orElseThrow(() ->
        new ResourceNotFoundException("Movie not found with id: " + id));
}
public Movie updateMovie(Long id, Movie updatedMovie) {
    Movie existingMovie = movieRepository.findById(id)
           .orElseThrow(() ->
        new ResourceNotFoundException("Movie not found with id: " + id));

    existingMovie.setTitle(updatedMovie.getTitle());
    existingMovie.setGenre(updatedMovie.getGenre());
    existingMovie.setRating(updatedMovie.getRating());
    existingMovie.setOverview(updatedMovie.getOverview());

    return movieRepository.save(existingMovie);
}
}
