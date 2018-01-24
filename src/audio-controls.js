const css = require('dom-css')

module.exports = function createAudioControls (audio, tracks) {
  tracks = tracks.map(t => Object.assign({}, t))
  const controlsContainer = document.createElement('div')
  const trackSelector = document.createElement('ul')
  // const titleEl = controlsContainer.appendChild(document.createElement('div'))
  const timeEl = controlsContainer.appendChild(document.createElement('div'))
  const seekerEl = controlsContainer.appendChild(document.createElement('div'))
  controlsContainer.appendChild(trackSelector)
  const progressEl = seekerEl.appendChild(document.createElement('div'))
  const height = 3
  const width = 290
  const padding = 25

  tracks.map((track, i) => {
    const trackEl = trackSelector.appendChild(document.createElement('li'))
    trackEl.addEventListener('click', () => {
      setTrack(tracks[i])
      audio.play()
    })
    trackEl.innerText = '0' + (1 + i) + '. ' + track.title
    css(trackEl, { margin: `10px 0 10px ${padding}px`, position: 'relative' })
    track.el = trackEl
  })

  function setTrack (track) {
    audio.src = track.path
    timeEl.parentElement.removeChild(timeEl)
    track.el.appendChild(timeEl)
    tracks.forEach(t => css(t.el, 'color', '#888'))
    css(track.el, 'color', '#eee')
    // titleEl.innerText = track.title
  }

  setTrack(tracks[0])
  // audio.play()
  const paddingTop = 0
  css(controlsContainer, { width, paddingTop: paddingTop, position: 'relative', backgroundColor: 'rgba(60, 60, 60, 0.65)', border: '1px solid rgb(80, 80, 80)' })
  css(trackSelector, { margin: '20px 0', position: 'relative', zIndex: 10, fontFamily: 'monospace', cursor: 'pointer', fontSize: 13, color: '#888', listStyle: 'none', padding: 0 })
  // css(titleEl, { padding: `0 0 20px ${padding}px`, fontWeight: 200, fontFamily: 'monospace', fontSize: 18, color: '#eee' })
  css(timeEl, { position: 'absolute', top: 0, right: padding, fontWeight: 200, fontFamily: 'monospace', fontSize: 13, color: '#eee' })
  css(seekerEl, { height, width, backgroundColor: 'rgba(90, 90, 90, 0.5)', cursor: 'pointer', position: 'relative' })
  css(progressEl, { height: '100%', position: 'absolute', top: 0, left: -1, backgroundColor: '#eee' })

  function tick () {
    const t = audio.currentTime / audio.duration
    css(progressEl, 'width', `${t * 100}%`)
    timeEl.innerText = formatSeconds(audio.currentTime)
  }

  seekerEl.addEventListener('click', e => {
    const { left } = seekerEl.getBoundingClientRect()
    const t = (e.clientX - left) / width
    audio.currentTime = t * audio.duration
  })

  window.addEventListener('keypress', (e) => {
    if (e.key === ' ') {
      togglePlay()
    }
  })

  return {
    el: controlsContainer,
    tick: tick
  }

  function togglePlay () {
    if (audio.paused) {
      audio.play()
    } else {
      audio.pause()
    }
  }
}

function formatSeconds (seconds) {
  const minutes = seconds / 60 | 0
  seconds = '' + (seconds % 60 | 0)
  if (seconds.length === 1) {
    seconds = `0${seconds}`
  }
  return `${minutes}:${seconds}`
}
