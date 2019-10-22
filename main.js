function createResolvablePromise () {
  let resolve
  const promise = new Promise(res => (resolve = res))
  return {promise, resolve}
}

const boundingBoxes = new Map()
const sceneOrder = []
let width = window.innerWidth
let height = window.innerHeight

function updateScenes () {
  const base = (height + boundingBoxes.get(sceneOrder[0]).height) / 2
  let offset = 0
  for (const scene of sceneOrder) {
    const box = boundingBoxes.get(scene)
    offset += box.height
    scene.style.top = (base - offset < 0 && scene === sceneOrder[0] ? 0 : base - offset) + 'px'
    scene.style.left = ((width - box.width) / 2) + 'px'
  }
}

fetch('./game.json')
  .then(r => r.json())
  .then(async gameData => {
    let scene = gameData.INIT
    while (scene) {
      if (typeof scene === 'string') {
        scene = gameData[scene]
        continue
      }

      const sceneElem = Elem('div', {className: 'entry'})
      const {promise: sceneEndProm, resolve: done} = createResolvablePromise()

      if (scene.special) {
        switch (scene.special) {
          case 'title': {
            scene = scene.continue
            break
          }
        }
      } else {
        sceneElem.appendChild(Fragment([
          Elem('div', {className: 'message'}, [scene.message]),
          ...Object.entries(scene.choices).map(([choiceMsg, choiceScene]) =>
            Elem('div', {
              className: 'choice',
              onclick: e => {
                scene = choiceScene
                done()
              }
            }, [choiceMsg]))
        ]))
      }

      document.body.appendChild(sceneElem)
      sceneElem.focus()
      await Promise.all([
        sceneEndProm,
        new Promise(res => window.requestAnimationFrame(() => {
          boundingBoxes.set(sceneElem, sceneElem.getBoundingClientRect())
          sceneOrder.unshift(sceneElem)
          updateScenes()
          res()
        }))
      ])
      sceneElem.classList.add('uninteractable')
    }
  })

window.addEventListener('resize', e => {
  width = window.innerWidth
  height = window.innerHeight
  for (const [elem] of boundingBoxes) {
    boundingBoxes.set(elem, elem.getBoundingClientRect())
  }
  updateScenes()
})
