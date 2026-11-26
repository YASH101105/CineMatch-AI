// Fictional titles, artwork, dates and scores for the public preview.
const genres = [
  { id: 1, name: 'Science Fiction' },
  { id: 2, name: 'Drama' },
  { id: 3, name: 'Mystery' },
  { id: 4, name: 'Adventure' },
]

const samples = [
  ['Signal at Dawn', 2024, 8.4, [1, 3], 'Two radio engineers hear a message from a station that closed thirty years ago.', '#e18e54', '#193654'],
  ['The Last Crossing', 2022, 7.8, [2, 4], 'A ferry captain makes one final crossing with a passenger who knows the river by heart.', '#d1c8ac', '#22605d'],
  ['After the Monsoon', 2025, 8.1, [2], 'Two sisters return to their childhood cinema as the first monsoon clouds gather.', '#dda09e', '#48375c'],
  ['North of Midnight', 2023, 7.9, [3, 4], 'A cartographer follows a missing expedition beyond the last marked trail.', '#eacb70', '#315655'],
  ['The Quiet Orbit', 2021, 8.2, [1, 2], 'An orbital gardener receives a final packet of seeds from home.', '#b2bbdf', '#36375a'],
  ['Paper Lanterns', 2024, 7.6, [2, 3], 'A lantern maker finds a handwritten clue inside an order that nobody placed.', '#e8a376', '#692c45'],
]

function artwork(light, dark, index) {
  const x = 210 + index * 34
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="sky" x2="0.3" y2="1"><stop stop-color="${dark}"/><stop offset="1" stop-color="${light}"/></linearGradient></defs>
    <path fill="url(#sky)" d="M0 0h600v800H0z"/><circle cx="${x}" cy="275" r="125" fill="${light}"/>
    <g fill="${dark}"><path opacity=".55" d="M0 495l155-94 94 43 120-129 231 185v300H0z"/>
    <path opacity=".85" d="M0 580l202-146 121 105 128-103 149 134v230H0z"/>
    <path d="M0 681l188-113 171 58 148-68 93 39v203H0z"/></g></svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

const films = samples.map(([title, year, score, genreIds, overview, light, dark], index) => {
  const art = artwork(light, dark, index)
  return {
    id: index + 1, title, release_date: year + '-01-01', vote_average: score,
    genre_ids: genreIds, genres: genres.filter((genre) => genreIds.includes(genre.id)),
    overview, poster_path: art, backdrop_path: art,
  }
})

export function sampleResponse(input, method = 'GET') {
  if (method !== 'GET') throw new Error('Account changes require the full CineMatch server.')
  const { pathname, searchParams } = new URL(input, 'https://demo.invalid')
  if (pathname === '/api/tmdb/genres') return { genres }
  if (pathname === '/api/tmdb/trending') return { results: searchParams.get('page') === '2' ? [] : films }
  if (pathname === '/api/tmdb/search') {
    const query = (searchParams.get('query') || '').trim().toLowerCase()
    return { results: films.filter((film) => film.title.toLowerCase().includes(query)) }
  }
  if (pathname === '/api/tmdb/discover') {
    const id = Number(searchParams.get('genreId'))
    return { results: films.filter((film) => film.genre_ids.includes(id)) }
  }
  if (pathname.startsWith('/api/comments/movie/')) return []
  if (pathname.startsWith('/api/ratings/movie/')) return null
  const match = pathname.match(/^\/api\/tmdb\/movie\/(\d+)(?:\/(images|recommendations))?$/)
  const film = match && films.find((item) => item.id === Number(match[1]))
  if (!film) throw new Error('Unavailable in the sample catalogue.')
  if (match[2] === 'images') return { backdrops: [] }
  if (match[2] === 'recommendations') {
    return { results: films.filter((item) => item !== film && item.genre_ids.some((id) => film.genre_ids.includes(id))) }
  }
  return film
}
