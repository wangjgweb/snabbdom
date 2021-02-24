import { Module } from './modules/module'
import { vnode, VNode } from './vnode'
import * as is from './is'
import { htmlDomApi, DOMAPI } from './htmldomapi'

type NonUndefined<T> = T extends undefined ? never : T

function isUndef (s: any): boolean {
  return s === undefined
}
function isDef<A> (s: A): s is NonUndefined<A> {
  return s !== undefined
}

type VNodeQueue = VNode[]

const emptyNode = vnode('', {}, [], undefined, undefined)

function sameVnode (vnode1: VNode, vnode2: VNode): boolean {
  return vnode1.key === vnode2.key && vnode1.sel === vnode2.sel
}

function isVnode (vnode: any): vnode is VNode {
  return vnode.sel !== undefined
}

type KeyToIndexMap = {[key: string]: number}

type ArraysOf<T> = {
  [K in keyof T]: Array<T[K]>;
}

type ModuleHooks = ArraysOf<Required<Module>>

function createKeyToOldIdx (children: VNode[], beginIdx: number, endIdx: number): KeyToIndexMap {
  const map: KeyToIndexMap = {}
  for (let i = beginIdx; i <= endIdx; ++i) {
    const key = children[i]?.key
    if (key !== undefined) {
      map[key] = i
    }
  }
  return map
}

const hooks: Array<keyof Module> = ['create', 'update', 'remove', 'destroy', 'pre', 'post']

export function init (modules: Array<Partial<Module>>, domApi?: DOMAPI) {
  let i: number
  let j: number
  // 钩子函数对象
  const cbs: ModuleHooks = {
    create: [],
    update: [],
    remove: [],
    destroy: [],
    pre: [],
    post: []
  }

  const api: DOMAPI = domApi !== undefined ? domApi : htmlDomApi

  // 将初始化时传入的各个模块的钩子函数，添加到cbs对象各对应钩子的数组内
  for (i = 0; i < hooks.length; ++i) {
    cbs[hooks[i]] = []
    for (j = 0; j < modules.length; ++j) {
      const hook = modules[j][hooks[i]]
      if (hook !== undefined) {
        (cbs[hooks[i]] as any[]).push(hook)
      }
    }
  }

  function emptyNodeAt (elm: Element) {
    const id = elm.id ? '#' + elm.id : ''
    const c = elm.className ? '.' + elm.className.split(' ').join('.') : ''
    return vnode(api.tagName(elm).toLowerCase() + id + c, {}, [], undefined, elm)
  }

  function createRmCb (childElm: Node, listeners: number) {
    return function rmCb () {
      if (--listeners === 0) {
        const parent = api.parentNode(childElm) as Node
        api.removeChild(parent, childElm)
      }
    }
  }

  // 给vnode的elm赋值，创建真实elm节点
  function createElm (vnode: VNode, insertedVnodeQueue: VNodeQueue): Node {
    let i: any
    let data = vnode.data
    if (data !== undefined) {
      // 执行data对象hook内的init
      const init = data.hook?.init
      if (isDef(init)) {
        init(vnode)
        data = vnode.data
      }
    }
    const children = vnode.children
    const sel = vnode.sel
    // 如果是注释节点
    if (sel === '!') {
      if (isUndef(vnode.text)) {
        vnode.text = ''
      }
      // 创建注释节点
      vnode.elm = api.createComment(vnode.text!)
    } else if (sel !== undefined) {
      // Parse selector
      const hashIdx = sel.indexOf('#')
      const dotIdx = sel.indexOf('.', hashIdx)
      const hash = hashIdx > 0 ? hashIdx : sel.length
      const dot = dotIdx > 0 ? dotIdx : sel.length
      // 获取tag标签名
      const tag = hashIdx !== -1 || dotIdx !== -1 ? sel.slice(0, Math.min(hash, dot)) : sel
      // 创建element
      const elm = vnode.elm = isDef(data) && isDef(i = data.ns)
        ? api.createElementNS(i, tag)
        : api.createElement(tag)
      // 设置id属性
      if (hash < dot) elm.setAttribute('id', sel.slice(hash + 1, dot))
      // 设置class属性
      if (dotIdx > 0) elm.setAttribute('class', sel.slice(dot + 1).replace(/\./g, ' '))
      // 循环遍历执行各模块的create钩子函数
      for (i = 0; i < cbs.create.length; ++i) cbs.create[i](emptyNode, vnode)
      // 判断子节点是否是一个数组
      if (is.array(children)) {
        for (i = 0; i < children.length; ++i) {
          const ch = children[i]
          if (ch != null) {
            // 递归调用createElm，将子节点添加到dom元素内
            api.appendChild(elm, createElm(ch as VNode, insertedVnodeQueue))
          }
        }
      } else if (is.primitive(vnode.text)) {
        // vnode的text属性与childer是互斥的，如果没有子节点，创建文本节点，挂载到dom中
        api.appendChild(elm, api.createTextNode(vnode.text))
      }
      const hook = vnode.data!.hook
      if (isDef(hook)) {
        // 执行vnode节点上的hook内的create钩子函数
        hook.create?.(emptyNode, vnode)
        if (hook.insert) {
          // 如果该vnode的hook含有insert钩子函数，添加到全局vnode数组中
          insertedVnodeQueue.push(vnode)
        }
      }
    } else {
      // 创建文本节点，添加到dom上
      vnode.elm = api.createTextNode(vnode.text!)
    }
    return vnode.elm
  }

  function addVnodes (
    parentElm: Node,
    before: Node | null,
    vnodes: VNode[],
    startIdx: number,
    endIdx: number,
    insertedVnodeQueue: VNodeQueue
  ) {
    for (; startIdx <= endIdx; ++startIdx) {
      // 循环遍历子节点，讲子节点，添加到dom元素上
      const ch = vnodes[startIdx]
      if (ch != null) {
        // 如果新增的节点内子节点还有子节点，createElm内部会递归调用自身，将elm挂载到dom上，每个函数的返回值都是vnode.elm(vnode真实的dom节点)
        api.insertBefore(parentElm, createElm(ch, insertedVnodeQueue), before)
      }
    }
  }
  // 执行销毁钩子函数 destroy
  function invokeDestroyHook (vnode: VNode) {
    const data = vnode.data
    if (data !== undefined) {
      data?.hook?.destroy?.(vnode)
      for (let i = 0; i < cbs.destroy.length; ++i) cbs.destroy[i](vnode)
      if (vnode.children !== undefined) {
        for (let j = 0; j < vnode.children.length; ++j) {
          const child = vnode.children[j]
          if (child != null && typeof child !== 'string') {
            // 递归执行子节点destroy钩子函数
            invokeDestroyHook(child)
          }
        }
      }
    }
  }

  function removeVnodes (parentElm: Node,
    vnodes: VNode[],
    startIdx: number,
    endIdx: number): void {
    for (; startIdx <= endIdx; ++startIdx) {
      let listeners: number
      let rm: () => void
      const ch = vnodes[startIdx]
      if (ch != null) {
        if (isDef(ch.sel)) {
          // 执行data.hook.destroy钩子函数, 各模块内destroy钩子函数
          invokeDestroyHook(ch)
          listeners = cbs.remove.length + 1
          // 获取一个删除子节点的函数
          rm = createRmCb(ch.elm!, listeners)
          // 执行各模块remove钩子函数，此时，每执行一次rm，listeners都会减1
          // 由于listeners = cbs.remove.length + 1,所以，在执行完cbs内所有remove钩子函数后，执行删除节点的操作
          for (let i = 0; i < cbs.remove.length; ++i) cbs.remove[i](ch, rm)
          const removeHook = ch?.data?.hook?.remove
          // 执行hook中remove，如果vnode中定义了hook.remove钩子函数，则将rm传递过去
          // 在remove钩子函数中手动执行rm回调，删除节点
          if (isDef(removeHook)) {
            removeHook(ch, rm)
          } else {
            rm()
          }
        } else { // Text node
          // 若果非vnode，直接删除节点
          api.removeChild(parentElm, ch.elm!)
        }
      }
    }
  }

  function updateChildren (parentElm: Node,
    oldCh: VNode[],
    newCh: VNode[],
    insertedVnodeQueue: VNodeQueue) {
    // 初始化新、旧节点指针索引变量、节点变量
    let oldStartIdx = 0
    let newStartIdx = 0
    let oldEndIdx = oldCh.length - 1
    let oldStartVnode = oldCh[0]
    let oldEndVnode = oldCh[oldEndIdx]
    let newEndIdx = newCh.length - 1
    let newStartVnode = newCh[0]
    let newEndVnode = newCh[newEndIdx]
    let oldKeyToIdx: KeyToIndexMap | undefined
    let idxInOld: number
    let elmToMove: VNode
    let before: any

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      if (oldStartVnode == null) {
        // 如果旧子节点数组第一个节点为null,指针向后移动一位
        oldStartVnode = oldCh[++oldStartIdx] // Vnode might have been moved left
      } else if (oldEndVnode == null) {
        // 旧子节点数组最后一个节点为null,指针向前移动一个
        oldEndVnode = oldCh[--oldEndIdx]
      } else if (newStartVnode == null) {
        // 新子节点数组第一个节点为null，指针向后移动一个
        newStartVnode = newCh[++newStartIdx]
      } else if (newEndVnode == null) {
        // 如果新子节点数组最后一个为null，指针向前移动一个
        newEndVnode = newCh[--newEndIdx]
      } else if (sameVnode(oldStartVnode, newStartVnode)) {
        // 如果新、旧子节点开始节点相同，则调用patchvnode
        patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue)
        // 新、旧指针向后移动一个
        oldStartVnode = oldCh[++oldStartIdx]
        newStartVnode = newCh[++newStartIdx]
      } else if (sameVnode(oldEndVnode, newEndVnode)) {
        // 如果新、旧子节点末尾几点相同，调用patchVnode
        patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue)
        // 新、旧指针向前移动一个
        oldEndVnode = oldCh[--oldEndIdx]
        newEndVnode = newCh[--newEndIdx]
      } else if (sameVnode(oldStartVnode, newEndVnode)) { // Vnode moved right
        // 如果旧子节点首位与新子节点尾位相同，调用patchVnode
        patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue)
        // 移动旧子节点首尾移动到末尾
        // 注意：此处是移动到oldEndVnode后一个节点的前面，而不是oldEndVnode节点对的前面，所以是移动到末尾
        api.insertBefore(parentElm, oldStartVnode.elm!, api.nextSibling(oldEndVnode.elm!))
        // 旧子节点指针向后移动一个
        oldStartVnode = oldCh[++oldStartIdx]
        // 新子节点指针向前移动一个
        newEndVnode = newCh[--newEndIdx]
      } else if (sameVnode(oldEndVnode, newStartVnode)) { // Vnode moved left
        // 如果旧节点最后一个与新子节点首位相同，移动旧子节点最后一个节点到首位
        patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue)
        api.insertBefore(parentElm, oldEndVnode.elm!, oldStartVnode.elm!)
        // 旧子节点指针向前一位
        oldEndVnode = oldCh[--oldEndIdx]
        // 新子节点指针向后一位
        newStartVnode = newCh[++newStartIdx]
      } else {
        if (oldKeyToIdx === undefined) {
          // 一个key与idx对应的map对象， 遍历子节点，创建一个{key: index}对象
          // 如果key值不唯一或者使用数组index，就不能准确找到对应的旧vnode，从而不能实现复用，导致更多的dom操作
          oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx)
        }
        // 获取新节点对应老节点中的索引
        idxInOld = oldKeyToIdx[newStartVnode.key as string]
        if (isUndef(idxInOld)) { // New element
          // 如果未定义，说明该节点是一个新节点，将新节点插入到旧子节点首位
          api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm!)
        } else {
          // 如果找到该节点在老节点中的索引，说明不是一个新节点，在剩余待便利的老节点中，找到了这个新节点
          elmToMove = oldCh[idxInOld]
          if (elmToMove.sel !== newStartVnode.sel) {
            // 如果已经不是同一个vnode了，直接在旧子节点前插入该新节点
            api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm!)
          } else {
            // 如果是同一个vnode，递归调用patchVnode，对比这个老节点与新节点
            patchVnode(elmToMove, newStartVnode, insertedVnodeQueue)
            // 将旧节点设置undefined 下次遍历到该节点的位置时，指针会直接向后/向前移动一位，因为当前节点elm已经移动到首位了
            oldCh[idxInOld] = undefined as any
            // 移动该老节点到首尾
            api.insertBefore(parentElm, elmToMove.elm!, oldStartVnode.elm!)
          }
        }
        // 新节点指针向后移动一位
        newStartVnode = newCh[++newStartIdx]
      }
    }
    // 如果老节点遍历完 || 新节点遍历完
    if (oldStartIdx <= oldEndIdx || newStartIdx <= newEndIdx) {
      // 如果老节点先遍历完
      if (oldStartIdx > oldEndIdx) {
        before = newCh[newEndIdx + 1] == null ? null : newCh[newEndIdx + 1].elm
        // 将新节点剩余的dom插入进来
        // 插入到哪里呢？插入到当前新节点数组末尾索引的的后面，即最后一个索引下一个节点的前面
        addVnodes(parentElm, before, newCh, newStartIdx, newEndIdx, insertedVnodeQueue)
      } else {
        // 如果新节点先遍历万，则删除老节点剩余没有遍历到的部分
        removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx)
      }
    }
  }

  function patchVnode (oldVnode: VNode, vnode: VNode, insertedVnodeQueue: VNodeQueue) {
    const hook = vnode.data?.hook
    // 执行vnode内hook.prepatch钩子函数
    hook?.prepatch?.(oldVnode, vnode)
    const elm = vnode.elm = oldVnode.elm!
    const oldCh = oldVnode.children as VNode[]
    const ch = vnode.children as VNode[]
    // 如果是同一个dom节点，直接返回
    if (oldVnode === vnode) return
    if (vnode.data !== undefined) {
      // 执行update钩子函数
      for (let i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode)
      vnode.data.hook?.update?.(oldVnode, vnode)
    }
    // 如果新vnode没有text属性，说明不是一个文本节点
    if (isUndef(vnode.text)) {
      if (isDef(oldCh) && isDef(ch)) {
        // 如果新、旧节点都有子节点，且不相等，执行更新子节点方法
        if (oldCh !== ch) updateChildren(elm, oldCh, ch, insertedVnodeQueue)
      } else if (isDef(ch)) {
        // 如果只有新节点有子节点，旧节点没有子节点
        // 如果旧节点有内容，将旧节点文本设置为空字符串
        if (isDef(oldVnode.text)) api.setTextContent(elm, '')
        // 在dom元素行增加新vnode的子节点
        addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue)
      } else if (isDef(oldCh)) {
        // 如果新vnode没有子节点，删除旧vnode的子节点
        removeVnodes(elm, oldCh, 0, oldCh.length - 1)
      } else if (isDef(oldVnode.text)) {
        // 如果新旧vnode都没有子节点，将dom设置为空字符串
        api.setTextContent(elm, '')
      }
    } else if (oldVnode.text !== vnode.text) {
      // 如果新vnode是文本节点，且与旧vnode不一致
      // 如果旧vnode有子节点，删除子节点
      if (isDef(oldCh)) {
        removeVnodes(elm, oldCh, 0, oldCh.length - 1)
      }
      // 设置dom文本为新vnode文本
      api.setTextContent(elm, vnode.text!)
    }
    // 执行hook.postpatch钩子函数
    hook?.postpatch?.(oldVnode, vnode)
  }

  return function patch (oldVnode: VNode | Element, vnode: VNode): VNode {
    let i: number, elm: Node, parent: Node
    const insertedVnodeQueue: VNodeQueue = []
    // 执行各模块pre钩子函数
    for (i = 0; i < cbs.pre.length; ++i) cbs.pre[i]()
    // 判断是否是vnode
    if (!isVnode(oldVnode)) {
      // 如果不是vnode，将elm转为vnode
      oldVnode = emptyNodeAt(oldVnode)
    }
    // 判断是否是同一个vnode
    if (sameVnode(oldVnode, vnode)) {
      // 如果是同一个节点，对该节点进行更新
      patchVnode(oldVnode, vnode, insertedVnodeQueue)
    } else {
      // 如果不是同一个节点，就将新节点，替换旧节点
      elm = oldVnode.elm! // ts断言非空
      // 找到父节点
      parent = api.parentNode(elm) as Node
      // 为vnode赋值elm属性，创建真实的dom节点
      createElm(vnode, insertedVnodeQueue)

      if (parent !== null) {
        // 将新创建的dom节点添加到界面中
        api.insertBefore(parent, vnode.elm!, api.nextSibling(elm))
        // 移除旧节点
        removeVnodes(parent, [oldVnode], 0, 0)
      }
    }

    for (i = 0; i < insertedVnodeQueue.length; ++i) {
      // 循环遍历insertedVnodeQueue数组，执行insert钩子函数
      insertedVnodeQueue[i].data!.hook!.insert!(insertedVnodeQueue[i])
    }
    for (i = 0; i < cbs.post.length; ++i) cbs.post[i]()
    return vnode
  }
}
