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
  if (!sceneOrder.length) return
  const firstBox = boundingBoxes.get(sceneOrder[0].elem)
  const base = firstBox.height > height - MIN_TOP ? MIN_TOP + firstBox.height : (height + firstBox.height) / 2
  let offset = 0
  for (const {elem} of sceneOrder) {
    const box = boundingBoxes.get(elem)
    offset += box.height
    elem.style.top = (base - offset) + 'px'
    elem.style.left = ((width - box.width) / 2) + 'px'
  }
}

function format(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*([^*\\]+)\*/g, (_, em) => `<em>${em}</em>`) // *text* italicizes it
    .replace(/\*\\/g, '*') // *\ -> * (hopefully)
    .replace(/_([^_\\]+)_/g, (_, ins) => `<ins>${ins}</ins>`) // _text_ underlines it
    .replace(/_\\/g, '_') // _\ -> _
    .replace(/~([^_\\]+)~/g, (_, del) => `<del>${del}</del>`) // ~text~ strikes through it
    .replace(/~\\/g, '~') // ~\ -> ~
    .replace(/\n#(.*)\n/g, (_, note) => `\n<span class="note">${note}</span>`) // #text makes it a note
    .split('\n')
    .map(p => `<p>${p}</p>`)
    .join('')
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
          while (sceneOrder.length > 1) {
            document.body.removeChild(sceneOrder[sceneOrder.length - 1].elem)
            sceneOrder.pop()
          }
          entry.setScene(scene.continue)
          e.stopPropagation()
        }
      }, ['Continue'])
    ]))
  },
  default: (entry, scene) => {
    entry.elem.appendChild(Fragment([
      Elem('div', {className: 'message', innerHTML: format(scene.message)}),
      ...Object.entries(scene.choices || {}).map(([choiceMsg, choiceScene]) =>
        Elem('div', {
          className: 'choice',
          innerHTML: format(choiceMsg),
          onclick: e => {
            entry.setScene(choiceScene)
            e.stopPropagation()
          }
        }))
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
        continue
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

        if (scene.fail) {
          entry.elem.appendChild(Elem('div', {className: 'note'}, ['Click above to retry.']))
        }
      }

      entry.setScene = done
      entry.elem.classList.remove('uninteractable')
      if (scene.fail) document.body.classList.add('fail')

      const [newScene] = await Promise.all([
        sceneEndProm,
        new Promise(res => window.requestAnimationFrame(() => {
          boundingBoxes.set(entry.elem, entry.elem.getBoundingClientRect())
          updateScenes()
          res()
        }))
      ])

      entry.setScene = VOID
      entry.elem.classList.add('uninteractable')
      if (scene.fail) document.body.classList.remove('fail')

      scene = newScene
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
