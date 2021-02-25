/*
 * @Date: 2021-02-23 11:20:13
 * @FilePath: /snabbdom/src/package/vnode.ts
 * @Autor: wangjiguang
 * @LastEditors: Do not edit
 * @LastEditTime: 2021-02-23 15:07:57
 * @Description:
 */
import { Hooks } from './hooks'
import { AttachData } from './helpers/attachto'
import { VNodeStyle } from './modules/style'
import { On } from './modules/eventlisteners'
import { Attrs } from './modules/attributes'
import { Classes } from './modules/class'
import { Props } from './modules/props'
import { Dataset } from './modules/dataset'
import { Hero } from './modules/hero'

export type Key = string | number

export interface VNode {
  // 选择器
  sel: string | undefined
  // 传入的对象
  data: VNodeData | undefined
  // 子节点，是一个数组
  children: Array<VNode | string> | undefined
  // dom节点
  elm: Node | undefined
  // 与children互斥，字符串
  text: string | undefined
  // 从data中获取
  key: Key | undefined
}

export interface VNodeData {
  props?: Props
  attrs?: Attrs
  class?: Classes
  style?: VNodeStyle
  dataset?: Dataset
  on?: On
  hero?: Hero
  attachData?: AttachData
  hook?: Hooks
  key?: Key
  ns?: string // for SVGs
  fn?: () => VNode // for thunks
  args?: any[] // for thunks
  [key: string]: any // for any other 3rd party module
}

export function vnode (sel: string | undefined,
  data: any | undefined,
  children: Array<VNode | string> | undefined,
  text: string | undefined,
  elm: Element | Text | undefined): VNode {
  const key = data === undefined ? undefined : data.key
  return { sel, data, children, text, elm, key }
}
