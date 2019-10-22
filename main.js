const VOID = () => {}

function createResolvablePromise () {
  let resolve
  const promise = new Promise(res => (resolve = res))
  return {promise, resolve}
}

const boundingBoxes = new Map()
const sceneOrder = []
let width = window.innerWidth
let height = window.innerHeight

const MIN_TOP = 20
function updateScenes () {
  const base = (height + boundingBoxes.get(sceneOrder[0].elem).height) / 2
  let offset = 0
  for (const {elem} of sceneOrder) {
    const box = boundingBoxes.get(elem)
    offset += box.height
    elem.style.top = (base - offset < MIN_TOP && elem === sceneOrder[0].elem ? MIN_TOP : base - offset) + 'px'
    elem.style.left = ((width - box.width) / 2) + 'px'
  }
}

const sceneTypes = {
  title: (entry, scene) => {
    entry.elem.appendChild(Fragment([
      Elem('div', {className: 'title'}, [scene.title]),
      Elem('div', {className: 'subtitle'}, [scene.subtitle]),
      Elem('div', {className: 'cover'}),
      Elem('div', {
        className: 'choice',
        onclick: e => {
          entry.setScene(scene.continue)
          e.stopPropagation()
        }
      }, ['Continue'])
    ]))
  },
  default: (entry, scene) => {
    entry.elem.appendChild(Fragment([
      Elem('div', {className: 'message'}, [scene.message]),
      ...Object.entries(scene.choices || {}).map(([choiceMsg, choiceScene]) =>
        Elem('div', {
          className: 'choice',
          onclick: e => {
            entry.setScene(choiceScene)
            e.stopPropagation()
          }
        }, [choiceMsg]))
    ]))
  }
}

fetch('./game.json')
  .then(r => r.json())
  .then(async gameData => {
    let scene = gameData.INIT
    while (scene) {
      if (typeof scene === 'string') {
        scene = gameData[scene]
      }

      const {promise: sceneEndProm, resolve: done} = createResolvablePromise()
      let entry
      if (scene.isEntry) {
        entry = scene
        scene = entry.scene
      } else {
        entry = {
          isEntry: true,
          elem: Elem('div', {
            className: 'entry',
            onclick: e => {
              if (entry.elem.classList.contains('uninteractable')) {
                let firstEntry = sceneOrder[0]
                while (sceneOrder[0] && sceneOrder[0] !== entry) {
                  document.body.removeChild(sceneOrder[0].elem)
                  sceneOrder.shift()
                }
                firstEntry.setScene(entry)
                updateScenes()
              }
            }
          }),
          scene
        }
        sceneTypes[scene.special || 'default'](entry, scene)
        document.body.appendChild(entry.elem)
        sceneOrder.unshift(entry)
      }

      entry.setScene = newScene => {
        scene = newScene
        done()
      }
      entry.elem.classList.remove('uninteractable')

      await Promise.all([
        sceneEndProm,
        new Promise(res => window.requestAnimationFrame(() => {
          boundingBoxes.set(entry.elem, entry.elem.getBoundingClientRect())
          updateScenes()
          res()
        }))
      ])

      entry.setScene = VOID
      entry.elem.classList.add('uninteractable')
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
