import { useEffect, useRef, useState } from 'react'
import './App.css'

const API = '/api/tmdb'
const POSTER = 'https://image.tmdb.org/t/p/w500'
const BACKDROP = 'https://image.tmdb.org/t/p/w1280'
const STILL = 'https://image.tmdb.org/t/p/w780'

function movieId(movie) {
  return Number(movie?.id ?? movie?.movieId ?? 0)
}

function movieTitle(movie) {
  return movie?.title || movie?.name || movie?.movieTitle || 'Untitled film'
}

function formatCommentDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function normalizeMovie(movie) {
  if (!movie || movie.id) return movie
  return {
    id: movie.movieId,
    title: movie.movieTitle,
    poster_path: movie.posterPath,
    backdrop_path: movie.backdropPath,
    release_date: movie.releaseDate,
    vote_average: movie.voteAverage,
  }
}

async function requestJson(url, options = {}) {
  const retryable = !options.method || options.method.toUpperCase() === 'GET'
  const maxAttempts = retryable ? 3 : 1

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response
    try {
      response = await fetch(url, {
        credentials: 'same-origin',
        ...options,
        headers: { Accept: 'application/json', ...(options.headers || {}) },
      })
    } catch (error) {
      if (!retryable || attempt === maxAttempts) throw error
      await new Promise((resolve) => window.setTimeout(resolve, 300 * attempt))
      continue
    }

    const body = await response.text().catch(() => '')
    let data = body
    if (body) {
      try {
        data = JSON.parse(body)
      } catch {
        // Keep non-JSON error bodies readable to the user.
      }
    }

    if (!response.ok) {
      const canRetry = retryable && attempt < maxAttempts &&
        (response.status === 408 || response.status === 429 || response.status >= 500)
      if (canRetry) {
        await new Promise((resolve) => window.setTimeout(resolve, 300 * attempt))
        continue
      }

      const message = response.status === 502 || response.status === 503
        ? 'The movie service is temporarily unavailable. Please try again.'
        : data?.message ||
          data?.detail ||
          data?.error ||
          (typeof data === 'string' ? data : '') ||
          'The request could not be completed.'
      throw new Error(message)
    }
    return data
  }

  throw new Error('The request could not be completed. Please try again.')
}

async function mutateWithCsrf(url, method, payload) {
  const csrf = await requestJson('/api/auth/csrf')
  const options = {
    method,
    headers: { 'X-XSRF-TOKEN': csrf.token },
  }
  if (payload !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(payload)
  }
  return requestJson(url, options)
}

function readRecentMovies() {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(window.localStorage.getItem('cinematch-recent') || '[]')
  } catch {
    return []
  }
}

function MoviePoster({ movie }) {
  const [imageFailed, setImageFailed] = useState(false)
  const posterPath = movie?.poster_path || movie?.posterPath

  return (
    <div className="poster-wrap">
      {posterPath && !imageFailed ? (
        <img
          src={POSTER + posterPath}
          alt={movieTitle(movie) + ' poster'}
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="no-poster"><span>CM</span><small>NO POSTER</small></div>
      )}
      <span className="rating"><span aria-hidden="true">★</span> {Number(movie?.vote_average ?? movie?.voteAverage ?? 0).toFixed(1)}</span>
    </div>
  )
}

function MovieCard({ movie: rawMovie, onOpen, onFavorite, isFavorite, index = 0 }) {
  const movie = normalizeMovie(rawMovie)
  const title = movieTitle(movie)
  const year = (movie?.release_date || movie?.releaseDate || '').slice(0, 4)

  return (
    <article className="movie-card" style={{ '--card-delay': index * 45 + 'ms' }}>
      <button className="movie-open" type="button" onClick={() => onOpen(movie)} aria-label={'Open ' + title}>
        <MoviePoster movie={movie} />
        <span className="movie-info">
          <strong>{title}</strong>
          <small>{year || 'Release date unavailable'}</small>
        </span>
      </button>
      <button
        className={'favorite-toggle' + (isFavorite ? ' is-favorite' : '')}
        type="button"
        onClick={() => onFavorite(movie)}
        aria-label={(isFavorite ? 'Remove ' : 'Add ') + title + (isFavorite ? ' from favourites' : ' to favourites')}
        aria-pressed={isFavorite}
      >
        {isFavorite ? '♥' : '♡'}
      </button>
    </article>
  )
}

function GenreTile({ genre, imagePath, index, onClick }) {
  return (
    <button
      className="genre-tile"
      style={{ '--genre-hue': (index * 43 + 150) % 360, '--tile-delay': index * 45 + 'ms' }}
      type="button"
      onClick={onClick}
    >
      {imagePath ? <img className="genre-poster" src={POSTER + imagePath} alt="" loading="lazy" /> : <span className="genre-poster-fallback" aria-hidden="true">✦</span>}
      <span className="genre-label"><strong>{genre.name}</strong><small>Explore films</small></span>
      <span className="genre-arrow" aria-hidden="true">↗</span>
    </button>
  )
}

function AuthPage({ initialMode, onBack, onAuthenticated, movies = [] }) {
  const [mode, setMode] = useState(initialMode)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const posters = movies.filter((movie) => movie?.poster_path)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const path = mode === 'register' ? '/api/auth/register' : '/api/auth/login'
      const payload = mode === 'register'
        ? { displayName: displayName.trim(), email: email.trim(), password }
        : { email: email.trim(), password }
      onAuthenticated(await mutateWithCsrf(path, 'POST', payload))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setError('')
  }

  function renderPosterRails(railCount, startOffset, keyPrefix) {
    return Array.from({ length: railCount }, (_, railIndex) => {
      const sequenceLength = Math.max(6, Math.min(8, posters.length || 6))
      const sequence = Array.from({ length: sequenceLength }, (_, posterIndex) => (
        posters.length ? posters[(startOffset + railIndex * 3 + posterIndex) % posters.length] : null
      ))

      return (
        <div className="auth-poster-rail" key={keyPrefix + '-rail-' + railIndex} style={{ '--rail-duration': 30 + railIndex * 5 + 's', '--rail-delay': railIndex * -3.5 + 's' }}>
          {[0, 1].map((loopIndex) => (
            <div className="auth-poster-set" key={loopIndex} aria-hidden={loopIndex === 1}>
              {sequence.map((movie, posterIndex) => (
                <div className="auth-poster" key={keyPrefix + '-' + railIndex + '-' + loopIndex + '-' + posterIndex} style={{ '--poster-tilt': ((posterIndex % 3) - 1) * 1.3 + 'deg' }}>
                  {movie ? <img src={POSTER + movie.poster_path} alt="" loading="lazy" /> : <span className="auth-poster-placeholder">CINE<br /><b>MATCH</b></span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )
    })
  }

  return (
    <main className="auth-page">
      <div className="auth-art" aria-hidden="true">
        <div className="auth-art-glow" />
        <div className="auth-collage-grid">
          {renderPosterRails(4, 0, 'art')}
        </div>
        <div className="auth-art-copy"><span>TOP MOVIES THIS WEEK · RISING NOW</span><h2>New favourites<br />on the rise.</h2><p>Fresh stories keep rolling in.</p></div>
      </div>

      <div className="auth-panel">
        <div className="auth-panel-collage" aria-hidden="true">
          {renderPosterRails(3, 5, 'panel')}
        </div>
        <section className="auth-card" aria-labelledby="auth-title">
        <button className="text-button auth-back" type="button" onClick={onBack}>← Back to discovery</button>
        <span className="eyebrow">CINEMATCH MEMBERS</span>
        <h1 id="auth-title">{mode === 'register' ? 'Join the club.' : 'Welcome back.'}</h1>
        <p className="auth-intro">
          {mode === 'register'
            ? 'Save the films you love, keep your ratings, and find your next story.'
            : 'Sign in to return to your favourites and personal film shelf.'}
        </p>
        <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>Create account</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && (
            <label>Your name
              <input autoComplete="name" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="What should we call you?" required />
            </label>
          )}
          <label>Email address
            <input type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
          </label>
          <label>Password
            <input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 8 : 1} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'} required />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={busy}>
            {busy ? 'One moment…' : mode === 'register' ? 'Create my account' : 'Sign in to CineMatch'}
            {!busy && <span aria-hidden="true">↗</span>}
          </button>
        </form>
        <p className="auth-footnote">Passwords are hashed before they are stored.</p>
        </section>
      </div>
    </main>
  )
}

function MovieDetail({
  movie,
  details,
  loading,
  error,
  images,
  recommendations,
  ratingSummary,
  draftRating,
  ratingBusy,
  ratingMessage,
  comments,
  commentsLoading,
  commentDraft,
  commentBusy,
  commentError,
  commentMessage,
  isFavorite,
  favoriteIds,
  user,
  isFavoriteBusy,
  onBack,
  onOpen,
  onToggleFavorite,
  onRate,
  onSaveRating,
  onCommentDraftChange,
  onSubmitComment,
  onSignIn,
  onShowScreenshot,
}) {
  const activeMovie = details || movie
  const backdropPath = activeMovie?.backdrop_path || movie?.backdrop_path
  const year = (activeMovie?.release_date || movie?.release_date || '').slice(0, 4)
  const stills = images.length ? images : (backdropPath ? [{ file_path: backdropPath }] : [])
  const visibleStills = images.length ? images : stills
  const favoriteId = movieId(movie)

  return (
    <div className="detail-page">
      <section
        className="detail-hero"
        style={backdropPath ? { backgroundImage: 'linear-gradient(90deg, #07100ff5 0%, #07100fc7 43%, #07100f55 75%, #07100f65 100%), linear-gradient(0deg, #0a1010 0%, transparent 55%), url("' + BACKDROP + backdropPath + '")' } : undefined}
      >
        <div className="detail-hero-shade" />
        <button className="detail-back" type="button" onClick={onBack}>← Back to films</button>
        <div className="detail-copy">
          <span className="eyebrow">CINEMATCH FEATURE</span>
          <div className="detail-genres">
            {(details?.genres || []).slice(0, 4).map((genre) => <span key={genre.id}>{genre.name}</span>)}
          </div>
          <h1>{movieTitle(activeMovie)}</h1>
          <div className="detail-meta">
            <span className="tmdb-score">★ {Number(activeMovie?.vote_average || 0).toFixed(1)} <small>TMDB</small></span>
            {year && <span>{year}</span>}
            {details?.runtime > 0 && <span>{details.runtime} min</span>}
            {details?.original_language && <span>{details.original_language.toUpperCase()}</span>}
          </div>
          <p className="detail-overview">
            {loading ? 'Gathering the story behind this film…' : details?.overview || movie?.overview || 'A story waiting to be discovered.'}
          </p>
          <div className="detail-actions">
            <button className="primary-button" type="button" onClick={() => onShowScreenshot(stills[0]?.file_path || backdropPath)} disabled={!stills.length}>▶ <span>Explore stills</span></button>
            <button
              className={'outline-button' + (isFavorite ? ' saved' : '')}
              type="button"
              onClick={() => onToggleFavorite(movie)}
              disabled={isFavoriteBusy}
            >
              <span aria-hidden="true">{isFavorite ? '♥' : '♡'}</span>
              {isFavorite ? 'In my favourites' : 'Add to favourites'}
            </button>
          </div>
          {error && <p className="detail-error" role="alert">{error}</p>}
        </div>
        <div className="detail-poster">
          <MoviePoster movie={activeMovie} />
          <span className="poster-caption">A FILM TO REMEMBER</span>
        </div>
        <span className="detail-number">CM / {String(favoriteId).padStart(5, '0')}</span>
      </section>

      <section className="screenshots-section">
        <div className="content-section-heading">
          <div><span className="eyebrow">INSIDE THE FILM</span><h2>Screenshots</h2></div>
          <span className="section-count">{visibleStills.length} STILLS</span>
        </div>
        {loading && !images.length ? (
          <div className="still-skeletons"><span /><span /><span /><span /></div>
        ) : visibleStills.length ? (
          <div className="still-strip">
            {visibleStills.slice(0, 8).map((still, index) => (
              <button key={still.file_path + index} className="still-card" type="button" onClick={() => onShowScreenshot(still.file_path)} aria-label={'View screenshot ' + (index + 1) + ' from ' + movieTitle(activeMovie)}>
                <img src={STILL + still.file_path} alt={movieTitle(activeMovie) + ' movie still ' + (index + 1)} loading="lazy" />
                <span>↗</span>
              </button>
            ))}
          </div>
        ) : <p className="muted-message">No stills are available for this title yet.</p>}
      </section>

      <section className="rate-panel">
        <div className="rate-heading">
          <div><span className="eyebrow">YOUR TAKE</span><h3>Rate this film</h3></div>
          <div className="community-score"><strong>{Number(ratingSummary.averageRating || 0).toFixed(1)}</strong><span>/ 5 · {ratingSummary.ratingCount} {ratingSummary.ratingCount === 1 ? 'rating' : 'ratings'}</span></div>
        </div>
        <div className="star-picker" role="group" aria-label="Choose a rating from one to five stars">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} className={star <= draftRating ? 'star-button selected' : 'star-button'} type="button" aria-label={star + ' out of 5 stars'} aria-pressed={star === draftRating} onClick={() => user ? onRate(star) : onSignIn()}>
              ★
            </button>
          ))}
          <span className="rating-prompt">{draftRating ? draftRating + ' / 5' : 'Tap to rate'}</span>
        </div>
        <div className="rate-actions">
          <span className="rating-hint">{user ? 'Your score is saved to your account.' : <><button className="inline-link" type="button" onClick={onSignIn}>Sign in</button> to save your rating.</>}</span>
          {user && <button className="primary-button save-rating" type="button" onClick={onSaveRating} disabled={!draftRating || ratingBusy}>{ratingBusy ? 'Saving…' : 'Save rating'}</button>}
        </div>
        {ratingMessage && <p className="rating-message" role="status">{ratingMessage}</p>}
      </section>

      <section className="comments-section">
        <div className="content-section-heading">
          <div><span className="eyebrow">AFTER THE CREDITS</span><h2>Movie conversation</h2></div>
          <span className="section-count">{comments.length} {comments.length === 1 ? 'COMMENT' : 'COMMENTS'}</span>
        </div>

        {user ? (
          <form className="comment-form" onSubmit={onSubmitComment}>
            <div className="comment-form-heading"><span className="comment-avatar">{user.displayName.slice(0, 1).toUpperCase()}</span><span>What did you think of <strong>{movieTitle(activeMovie)}</strong>?</span></div>
            <textarea value={commentDraft} onChange={onCommentDraftChange} maxLength={1000} rows={3} placeholder="Share the moments, ideas, or details that stayed with you…" aria-label="Write a comment about this movie" required />
            <div className="comment-form-footer"><span>{commentDraft.length}/1000</span><button className="primary-button" type="submit" disabled={!commentDraft.trim() || commentBusy}>{commentBusy ? 'Posting…' : 'Post comment'}<span aria-hidden="true">↗</span></button></div>
          </form>
        ) : (
          <div className="comment-signin"><p>Join the conversation and share your take on this film.</p><button className="outline-button" type="button" onClick={onSignIn}>Sign in to comment <span aria-hidden="true">↗</span></button></div>
        )}
        {commentMessage && <p className="comment-message" role="status">{commentMessage}</p>}
        {commentError && <p className="comment-error" role="alert">{commentError}</p>}
        {commentsLoading ? <div className="comments-loading">Loading film conversation…</div> : comments.length ? (
          <div className="comment-list">
            {comments.map((comment) => (
              <article className="comment-card" key={comment.id}>
                <span className="comment-avatar">{(comment.displayName || 'F').slice(0, 1).toUpperCase()}</span>
                <div className="comment-body"><div className="comment-meta"><strong>{comment.displayName}</strong><time dateTime={comment.createdAt}>{formatCommentDate(comment.createdAt)}</time></div><p>{comment.content}</p></div>
              </article>
            ))}
          </div>
        ) : !commentsLoading && !commentError ? <div className="comments-empty">No comments yet. Start the conversation.</div> : null}
      </section>

      {recommendations.length > 0 && (
        <section className="detail-recommendations">
          <div className="content-section-heading">
            <div><span className="eyebrow">KEEP THE STORY GOING</span><h2>Watch next</h2></div>
          </div>
          <div className="movie-grid">
            {recommendations.slice(0, 6).map((recommendation, index) => (
              <MovieCard key={recommendation.id} movie={recommendation} onOpen={onOpen} onFavorite={onToggleFavorite} isFavorite={favoriteIds.has(movieId(recommendation))} index={index} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default function App() {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [view, setView] = useState('home')
  const [returnView, setReturnView] = useState('home')
  const [homeMovies, setHomeMovies] = useState([])
  const [homeLoading, setHomeLoading] = useState(true)
  const [homeError, setHomeError] = useState(false)
  const [homeRetry, setHomeRetry] = useState(0)
  const [genres, setGenres] = useState([])
  const [selectedGenre, setSelectedGenre] = useState(null)
  const [genreMovies, setGenreMovies] = useState([])
  const [genreLoading, setGenreLoading] = useState(false)
  const [genreError, setGenreError] = useState('')
  const [recentMovies, setRecentMovies] = useState(readRecentMovies)
  const [favorites, setFavorites] = useState([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  const [favoriteBusyId, setFavoriteBusyId] = useState(null)
  const [notice, setNotice] = useState('')

  const [user, setUser] = useState(null)
  const [authView, setAuthView] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [selected, setSelected] = useState(null)
  const [details, setDetails] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [screenshots, setScreenshots] = useState([])
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState('')
  const [ratingSummary, setRatingSummary] = useState({ averageRating: 0, ratingCount: 0, userRating: null })
  const [draftRating, setDraftRating] = useState(0)
  const [ratingBusy, setRatingBusy] = useState(false)
  const [ratingMessage, setRatingMessage] = useState('')
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [commentBusy, setCommentBusy] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [commentMessage, setCommentMessage] = useState('')
  const [lightboxPath, setLightboxPath] = useState(null)

  const searchInputRef = useRef(null)
  const movieRequestId = useRef(0)

  useEffect(() => {
    requestJson('/api/auth/me')
      .then((account) => { setUser(account); setFavoritesLoading(true) })
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false))

    Promise.all([
      requestJson(API + '/trending?page=1'),
      requestJson(API + '/trending?page=2').catch(() => null),
    ])
      .then(([firstPage, secondPage]) => {
        const combined = [...(firstPage.results || []), ...(secondPage?.results || [])]
        const uniqueMovies = [...new Map(combined.filter((movie) => movie?.id).map((movie) => [movie.id, movie])).values()]
        setHomeMovies(uniqueMovies)
        setHomeError(false)
      })
      .catch(() => {
        setHomeMovies([])
        setHomeError(true)
      })
      .finally(() => setHomeLoading(false))

    requestJson(API + '/genres')
      .then((data) => setGenres(data.genres || []))
      .catch(() => setGenres([]))
  }, [homeRetry])

  useEffect(() => {
    if (!user) return undefined
    let active = true
    requestJson('/api/favorites')
      .then((items) => { if (active) setFavorites(items) })
      .catch(() => { if (active) setFavorites([]) })
      .finally(() => { if (active) setFavoritesLoading(false) })
    return () => { active = false }
  }, [user])

  const favoriteIds = new Set(favorites.map((favorite) => Number(favorite.movieId)))

  function rememberMovie(movie) {
    const normalized = normalizeMovie(movie)
    const next = [normalized, ...recentMovies.filter((item) => movieId(item) !== movieId(normalized))].slice(0, 10)
    setRecentMovies(next)
    try {
      window.localStorage.setItem('cinematch-recent', JSON.stringify(next))
    } catch {
      // Recent history is a convenience; movie details still work without local storage.
    }
  }

  async function runSearch(searchTerm) {
    const term = searchTerm.trim()
    if (!term) return
    setQuery(term)
    setSearchLoading(true)
    setSearchError('')
    setSearchResults([])
    setView('search')
    try {
      const data = await requestJson(API + '/search?query=' + encodeURIComponent(term))
      const results = (data.results || []).filter((movie) => movie && movie.id)
      setSearchResults(results)
      if (!results.length) setSearchError('No films found for “' + term + '”. Try another search.')
    } catch (requestError) {
      setSearchError(requestError.message || 'Could not reach the movie service.')
    } finally {
      setSearchLoading(false)
      window.setTimeout(() => searchInputRef.current?.blur(), 0)
    }
  }

  function searchMovies(event) {
    event.preventDefault()
    return runSearch(query)
  }

  async function loadGenre(genre) {
    setSelectedGenre(genre)
    setView('genre')
    setGenreMovies([])
    setGenreError('')
    setGenreLoading(true)
    try {
      const data = await requestJson(API + '/discover?genreId=' + genre.id)
      setGenreMovies((data.results || []).filter((movie) => movie && movie.id))
    } catch (requestError) {
      setGenreError(requestError.message || 'Could not load this genre.')
    } finally {
      setGenreLoading(false)
    }
  }

  function navigate(nextView) {
    if ((nextView === 'favorites' || nextView === 'collection') && !user) {
      setAuthView('login')
      return
    }
    setView(nextView)
    setSelected(null)
    setDetails(null)
    setNotice('')
  }

  async function openMovie(rawMovie) {
    const movie = normalizeMovie(rawMovie)
    if (!movie?.id) return
    if (view !== 'detail') setReturnView(view)
    movieRequestId.current += 1
    const requestId = movieRequestId.current

    setView('detail')
    setSelected(movie)
    setDetails(null)
    setRecommendations([])
    setScreenshots([])
    setDetailsError('')
    setRatingSummary({ averageRating: 0, ratingCount: 0, userRating: null })
    setDraftRating(0)
    setRatingMessage('')
    setComments([])
    setCommentsLoading(true)
    setCommentDraft('')
    setCommentError('')
    setCommentMessage('')
    setDetailsLoading(true)
    rememberMovie(movie)

    const imageRequest = requestJson(API + '/movie/' + movie.id + '/images').catch(() => ({ backdrops: [] }))
    const ratingRequest = requestJson('/api/ratings/movie/' + movie.id).catch(() => null)
    requestJson('/api/comments/movie/' + movie.id)
      .then((items) => { if (requestId === movieRequestId.current) setComments(Array.isArray(items) ? items : []) })
      .catch(() => { if (requestId === movieRequestId.current) setCommentError('Comments are unavailable right now. Please try again later.') })
      .finally(() => { if (requestId === movieRequestId.current) setCommentsLoading(false) })
    try {
      const [movieDetails, recommendationData, imageData, communityRating] = await Promise.all([
        requestJson(API + '/movie/' + movie.id),
        requestJson(API + '/movie/' + movie.id + '/recommendations'),
        imageRequest,
        ratingRequest,
      ])
      if (requestId !== movieRequestId.current) return
      if (Number(movieDetails.id) !== Number(movie.id)) {
        throw new Error('The returned movie ID does not match the selected movie.')
      }

      setDetails(movieDetails)
      setRecommendations(
        (recommendationData.results || [])
          .filter((item) => item.id && Number(item.id) !== Number(movie.id))
          .slice(0, 10)
      )
      const imagePaths = (imageData.backdrops || [])
        .filter((image) => image.file_path && image.file_path !== movieDetails.backdrop_path)
        .sort((first, second) => (second.vote_average || 0) - (first.vote_average || 0))
      setScreenshots(imagePaths)
      if (communityRating) {
        setRatingSummary(communityRating)
        setDraftRating(communityRating.userRating || 0)
      }
    } catch (requestError) {
      if (requestId === movieRequestId.current) {
        setDetailsError(requestError.message || 'Could not load this film.')
      }
    } finally {
      if (requestId === movieRequestId.current) setDetailsLoading(false)
    }
  }

  async function toggleFavorite(rawMovie) {
    const movie = normalizeMovie(rawMovie)
    if (!user) {
      setAuthView('login')
      return
    }
    const id = movieId(movie)
    if (!id) return
    setFavoriteBusyId(id)
    setNotice('')
    try {
      if (favoriteIds.has(id)) {
        await mutateWithCsrf('/api/favorites/' + id, 'DELETE')
        setFavorites((current) => current.filter((favorite) => Number(favorite.movieId) !== id))
        setNotice('Removed from your favourites.')
      } else {
        const favorite = await mutateWithCsrf('/api/favorites', 'POST', {
          movieId: id,
          movieTitle: movieTitle(movie),
          posterPath: movie.poster_path || movie.posterPath || null,
          backdropPath: movie.backdrop_path || movie.backdropPath || null,
          releaseDate: movie.release_date || movie.releaseDate || null,
          voteAverage: Number(movie.vote_average ?? movie.voteAverage ?? 0),
        })
        setFavorites((current) => [favorite, ...current.filter((item) => Number(item.movieId) !== id)])
        setNotice('Added to your favourites.')
      }
    } catch (requestError) {
      setNotice(requestError.message || 'Could not update your favourites.')
    } finally {
      setFavoriteBusyId(null)
    }
  }

  async function saveRating() {
    if (!user) {
      setAuthView('login')
      return
    }
    if (!selected || draftRating < 1 || ratingBusy) return
    setRatingBusy(true)
    setRatingMessage('')
    try {
      const summary = await mutateWithCsrf('/api/ratings', 'POST', {
        movieId: movieId(selected),
        movieTitle: movieTitle(selected),
        score: draftRating,
      })
      setRatingSummary(summary)
      setRatingMessage('Your rating is saved.')
    } catch (requestError) {
      setRatingMessage(requestError.message || 'Could not save your rating.')
    } finally {
      setRatingBusy(false)
    }
  }

  async function submitComment(event) {
    event.preventDefault()
    if (!user) {
      setAuthView('login')
      return
    }
    const content = commentDraft.trim()
    if (!selected || !content || commentBusy) return
    setCommentBusy(true)
    setCommentError('')
    setCommentMessage('')
    try {
      const created = await mutateWithCsrf('/api/comments', 'POST', {
        movieId: movieId(selected),
        movieTitle: movieTitle(selected),
        content,
      })
      setComments((current) => [created, ...current])
      setCommentDraft('')
      setCommentMessage('Your comment was posted.')
    } catch (requestError) {
      setCommentError(requestError.message || 'Could not post your comment.')
    } finally {
      setCommentBusy(false)
    }
  }

  async function logOut() {
    try {
      await mutateWithCsrf('/api/auth/logout', 'POST', {})
      setUser(null)
      setFavorites([])
      setFavoritesLoading(false)
      setNotice('You have signed out.')
    } catch (requestError) {
      setNotice(requestError.message || 'Could not sign out.')
    }
  }

  function backFromDetail() {
    setView(returnView || 'home')
    setSelected(null)
    setDetails(null)
    setScreenshots([])
    setNotice('')
  }

  function renderCards(movies, emptyMessage) {
    if (!movies.length) return <div className="empty-state"><span className="empty-mark">✳</span><h3>{emptyMessage}</h3></div>
    return (
      <div className="movie-grid">
        {movies.map((movie, index) => (
          <MovieCard
            key={movieId(movie)}
            movie={movie}
            onOpen={openMovie}
            onFavorite={toggleFavorite}
            isFavorite={favoriteIds.has(movieId(movie))}
            index={index}
          />
        ))}
      </div>
    )
  }

  function renderGenreTiles(list = genres) {
    return (
      <div className="genre-grid">
        {list.map((genre, index) => {
          const film = homeMovies.find((movie) => (movie.genre_ids || []).includes(genre.id) && movie.poster_path)
          return (
            <GenreTile
              key={genre.id}
              genre={genre}
              imagePath={film?.poster_path}
              index={index}
              onClick={() => loadGenre(genre)}
            />
          )
        })}
      </div>
    )
  }

  function renderHome() {
    const featured = homeMovies[0]
    const featureGenres = (featured?.genre_ids || [])
      .map((id) => genres.find((genre) => genre.id === id)?.name)
      .filter(Boolean)
      .slice(0, 2)

    return (
      <>
        <div className="feature-layout">
          <section
            className="feature-hero"
            style={featured?.backdrop_path ? { backgroundImage: 'linear-gradient(90deg, #07100fee 0%, #07100fae 48%, #07100f25 100%), linear-gradient(0deg, #0a1010 0%, transparent 45%), url("' + BACKDROP + featured.backdrop_path + '")' } : undefined}
          >
            <div className="feature-copy">
              <span className="eyebrow"><i /> THIS WEEK AT CINEMATCH</span>
              {featureGenres.length > 0 && <div className="feature-tags">{featureGenres.map((genre) => <span key={genre}>{genre}</span>)}</div>}
              <h1>{featured ? movieTitle(featured) : homeLoading ? 'Finding your next film…' : 'Your next movie night starts here.'}</h1>
              <p>{featured?.overview || 'Discover striking stories, keep the ones you love, and find another worth staying up for.'}</p>
              {featured && (
                <div className="feature-actions">
                  <button className="primary-button" type="button" onClick={() => openMovie(featured)}>▶ <span>Explore film</span></button>
                  <button className={'outline-button' + (favoriteIds.has(movieId(featured)) ? ' saved' : '')} type="button" onClick={() => toggleFavorite(featured)}>{favoriteIds.has(movieId(featured)) ? '♥' : '♡'} <span>{favoriteIds.has(movieId(featured)) ? 'In favourites' : 'Add to favourites'}</span></button>
                </div>
              )}
              <div className="feature-index"><strong>01</strong><span>/ 07</span><i /></div>
              </div>
            {featured?.poster_path && <div className="feature-poster"><img src={POSTER + featured.poster_path} alt={movieTitle(featured) + ' poster'} /><span>FEATURED FILM</span></div>}
          </section>

          <aside className="genre-panel">
            <div className="content-section-heading">
              <div><span className="eyebrow">PICK A MOOD</span><h2>Categories</h2></div>
              <button className="view-all" type="button" onClick={() => navigate('genres')}>All genres <span>↗</span></button>
            </div>
            {renderGenreTiles(genres.slice(0, 8))}
          </aside>
        </div>

        {recentMovies.length > 0 && (
          <section className="catalog-section">
            <div className="content-section-heading">
              <div><span className="eyebrow">YOUR FILM TRAIL</span><h2>Recently explored</h2></div>
              <button className="view-all" type="button" onClick={() => navigate('recent')}>View all <span>↗</span></button>
            </div>
            <div className="movie-row">{recentMovies.slice(0, 6).map((movie, index) => (
              <MovieCard key={movieId(movie)} movie={movie} onOpen={openMovie} onFavorite={toggleFavorite} isFavorite={favoriteIds.has(movieId(movie))} index={index} />
            ))}</div>
          </section>
        )}

        <section className="catalog-section">
          <div className="content-section-heading">
              <div><span className="eyebrow">THE WORLD IS WATCHING{homeMovies.length ? ' · ' + homeMovies.length + ' FILMS' : ''}</span><h2>Trending this week</h2></div>
            <button className="view-all" type="button" onClick={() => navigate('explore')}>See all <span>↗</span></button>
          </div>
          {homeLoading ? <div className="loading-shelf">Curating this week’s films…</div> : homeError ? (
            <div className="empty-state"><span className="empty-mark">↻</span><h3>The film service could not be reached.</h3><p>Try loading the feed again in a moment.</p><button className="primary-button" type="button" onClick={() => { setHomeLoading(true); setHomeRetry((count) => count + 1) }}>Try again</button></div>
          ) : renderCards(homeMovies.slice(0, 16), 'Trending films will appear here.')}
        </section>

        {user && favorites.length > 0 && (
          <section className="catalog-section">
            <div className="content-section-heading">
              <div><span className="eyebrow">KEPT CLOSE</span><h2>Your favourites</h2></div>
              <button className="view-all" type="button" onClick={() => navigate('favorites')}>Open list <span>↗</span></button>
            </div>
            <div className="movie-row">{favorites.slice(0, 6).map((favorite, index) => (
              <MovieCard key={favorite.movieId} movie={favorite} onOpen={openMovie} onFavorite={toggleFavorite} isFavorite index={index} />
            ))}</div>
          </section>
        )}
      </>
    )
  }

  function renderPage() {
    if (view === 'detail' && selected) {
      const isFavorite = favoriteIds.has(movieId(selected))
      return (
        <MovieDetail
          key={movieId(selected)}
          movie={selected}
          details={details}
          loading={detailsLoading}
          error={detailsError}
          images={screenshots}
          recommendations={recommendations}
          ratingSummary={ratingSummary}
          draftRating={draftRating}
          ratingBusy={ratingBusy}
          ratingMessage={ratingMessage}
          comments={comments}
          commentsLoading={commentsLoading}
          commentDraft={commentDraft}
          commentBusy={commentBusy}
          commentError={commentError}
          commentMessage={commentMessage}
          isFavorite={isFavorite}
          favoriteIds={favoriteIds}
          isFavoriteBusy={favoriteBusyId === movieId(selected)}
          user={user}
          onBack={backFromDetail}
          onOpen={openMovie}
          onToggleFavorite={toggleFavorite}
          onRate={(score) => { setDraftRating(score); setRatingMessage('') }}
          onSaveRating={saveRating}
          onCommentDraftChange={(event) => setCommentDraft(event.target.value)}
          onSubmitComment={submitComment}
          onSignIn={() => setAuthView('login')}
          onShowScreenshot={(path) => path && setLightboxPath(path)}
        />
      )
    }

    if (view === 'home') return renderHome()

    if (view === 'genres') {
      return <section className="catalog-section page-section genre-directory"><div className="content-section-heading"><div><span className="eyebrow">FIND YOUR KIND OF STORY</span><h1>Genres</h1></div></div>{renderGenreTiles()}</section>
    }

    if (view === 'genre') {
      return <section className="catalog-section page-section"><div className="content-section-heading"><div><button className="back-link" type="button" onClick={() => setView('genres')}>← All genres</button><span className="eyebrow">A LITTLE OF WHAT YOU LOVE</span><h1>{selectedGenre?.name || 'Genre films'}</h1></div></div>{genreLoading ? <div className="loading-shelf">Finding films…</div> : genreError ? <div className="empty-state"><h3>{genreError}</h3></div> : renderCards(genreMovies, 'No films found in this genre.')}</section>
    }

    if (view === 'favorites' || view === 'collection') {
      return <section className="catalog-section page-section"><div className="content-section-heading"><div><span className="eyebrow">YOUR PERSONAL SHELF</span><h1>{view === 'collection' ? 'My collection' : 'Favourites'}</h1></div><span className="section-count">{favorites.length} SAVED</span></div>{favoritesLoading ? <div className="loading-shelf">Opening your collection…</div> : renderCards(favorites, 'Your favourites will live here. Tap the heart on any film to save it.')}</section>
    }

    if (view === 'recent') {
      return <section className="catalog-section page-section"><div className="content-section-heading"><div><span className="eyebrow">YOUR FILM TRAIL</span><h1>Recently explored</h1></div></div>{renderCards(recentMovies, 'Films you explore will show up here.')}</section>
    }

    if (view === 'search') {
      return <section className="catalog-section page-section"><div className="content-section-heading"><div><span className="eyebrow">SEARCH RESULTS</span><h1>Films for “{query}”</h1></div><span className="section-count">{searchResults.length} FOUND</span></div>{searchLoading ? <div className="loading-shelf">Looking for your next favourite…</div> : searchError ? <div className="empty-state"><span className="empty-mark">✳</span><h3>{searchError}</h3></div> : renderCards(searchResults, 'No films found. Try another title.')}</section>
    }

    return <section className="catalog-section page-section"><div className="content-section-heading"><div><span className="eyebrow">DISCOVER WHAT’S MOVING</span><h1>Explore</h1></div></div>{renderCards(homeMovies, 'Trending films will appear here.')}</section>
  }

  const activeNavView = view === 'detail' ? returnView : view === 'search' ? 'explore' : view

  if (authView) {
    return (
      <div className="app-shell auth-shell">
        <AuthPage
          key={authView}
          initialMode={authView}
          movies={homeMovies}
          onBack={() => setAuthView(null)}
          onAuthenticated={(account) => { setUser(account); setFavoritesLoading(true); setAuthView(null); setNotice('Welcome to CineMatch, ' + account.displayName + '.') }}
        />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => navigate('home')} aria-label="CineMatch home">
          <span className="brand-mark"><span className="brand-reel">✦</span></span>
          <span className="brand-name">Cine<span>Match</span><small>YOUR FILM CLUB</small></span>
        </button>

        {user && (
          <div className="sidebar-user">
            <span className="sidebar-avatar">{user.displayName.slice(0, 1).toUpperCase()}</span>
            <span><strong>{user.displayName}</strong><small>Film enthusiast</small></span>
          </div>
        )}

        <nav className="side-nav" aria-label="Main navigation">
          <span className="nav-caption">MENU</span>
          {[
            ['home', '⌂', 'Home'],
            ['explore', '◈', 'Explore'],
            ['favorites', '♡', 'Favourites'],
            ['genres', '▤', 'Genres'],
          ].map(([key, icon, label]) => (
            <button key={key} className={'side-link' + (activeNavView === key || (key === 'favorites' && activeNavView === 'collection') ? ' active' : '')} type="button" onClick={() => navigate(key)}>
              <span className="side-icon" aria-hidden="true">{icon}</span>{label}
              {key === 'favorites' && favorites.length > 0 && <small className="nav-count">{favorites.length}</small>}
            </button>
          ))}

          <span className="nav-caption nav-caption-spaced">YOUR SHELF</span>
          <button className={'side-link' + (activeNavView === 'collection' ? ' active' : '')} type="button" onClick={() => navigate('collection')}><span className="side-icon" aria-hidden="true">▣</span>My collection</button>
          <button className={'side-link' + (activeNavView === 'recent' ? ' active' : '')} type="button" onClick={() => navigate('recent')}><span className="side-icon" aria-hidden="true">◷</span>Recently explored</button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-note"><span>✦</span><p>A good film makes<br />the evening.</p></div>
          {!user && !authLoading && <button className="sidebar-signin" type="button" onClick={() => setAuthView('login')}>Sign in to save films <span>↗</span></button>}
          {user && <button className="sidebar-signout" type="button" onClick={logOut}>Sign out <span>↗</span></button>}
        </div>
      </aside>

      <div className="main-frame">
        <header className="topbar">
          <div className="topbar-links">
            <button className={activeNavView === 'home' ? 'current' : ''} type="button" onClick={() => navigate('home')}>Movies</button>
            <button type="button" onClick={() => navigate('explore')}>Explore</button>
            <button type="button" onClick={() => navigate('genres')}>Genres</button>
            <button type="button" onClick={() => navigate('favorites')}>Collections</button>
          </div>

          <form className="top-search" onSubmit={searchMovies}>
            <span aria-hidden="true">⌕</span>
            <input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search films, directors, or actors…" aria-label="Search movies" />
            <button type="submit" aria-label="Search">↵</button>
          </form>

          {user ? (
            <div className="top-account"><span className="account-avatar">{user.displayName.slice(0, 1).toUpperCase()}</span><span>{user.displayName}</span></div>
          ) : (
            <button className="register-button" type="button" onClick={() => setAuthView('register')}>Register</button>
          )}
        </header>

        <main className="content-area">
          {notice && <div className="notice-bar" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
          {renderPage()}
        </main>

        <footer className="site-footer">
          <span>© CINEMATCH · A FILM CLUB FOR THE CURIOUS</span>
          <span>FILM DATA & IMAGES BY TMDB</span>
        </footer>
      </div>

      {lightboxPath && (
        <div className="screenshot-lightbox" role="dialog" aria-modal="true" aria-label="Movie screenshot" onMouseDown={(event) => { if (event.target === event.currentTarget) setLightboxPath(null) }}>
          <button type="button" onClick={() => setLightboxPath(null)} aria-label="Close screenshot">×</button>
          <img src={BACKDROP + lightboxPath} alt="Movie screenshot" />
        </div>
      )}
    </div>
  )
}

