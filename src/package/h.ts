/*
 * @Date: 2021-02-23 11:20:12
 * @FilePath: /snabbdom/src/package/h.ts
 * @Autor: wangjiguang
 * @LastEditors: Do not edit
 * @LastEditTime: 2021-02-24 21:36:23
 * @Description: 
 */
// 引入组件
import { vnode, VNode, VNodeData } from './vnode'
import * as is from './is'
// 定义类型
export type VNodes = VNode[]
export type VNodeChildElement = VNode | string | number | undefined | null
export type ArrayOrElement<T> = T | T[]
export type VNodeChildren = ArrayOrElement<VNodeChildElement>
// 处理svg
function addNS (data: any, children: VNodes | undefined, sel: string | undefined): void {
  data.ns = 'http://www.w3.org/2000/svg'
  if (sel !== 'foreignObject' && children !== undefined) {
    for (let i = 0; i < children.length; ++i) {
      const childData = children[i].data
      if (childData !== undefined) {
        addNS(childData, (children[i] as VNode).children as VNodes, children[i].sel)
      }
    }
  }
}
// 函数重载
export function h (sel: string): VNode
export function h (sel: string, data: VNodeData | null): VNode
export function h (sel: string, children: VNodeChildren): VNode
export function h (sel: string, data: VNodeData | null, children: VNodeChildren): VNode
export function h (sel: any, b?: any, c?: any): VNode {
  let data: VNodeData = {}
  let children: any
  let text: any
  let i: number
  // 如果传递第三个参数
  if (c !== undefined) {
    if (b !== null) {
      data = b
    }
    // 如果第三个参数是数组
    if (is.array(c)) {
      children = c
    } else if (is.primitive(c)) {
      // 如果第三个参数是字符串或者数字
      text = c
    } else if (c && c.sel) {
      // 如果第三个参数是vnode
      children = [c]
    }
  } else if (b !== undefined && b !== null) {
    // 如果只传了第二个参数，没有传第三个参数
    if (is.array(b)) {
      // 判断是否有子节点
      children = b
    } else if (is.primitive(b)) {
      text = b
    } else if (b && b.sel) {
      children = [b]
    } else { data = b }
  }
  if (children !== undefined) {
    // 若果子节点是字符串或者是数字，将子节点转换为vnode
    for (i = 0; i < children.length; ++i) {
      if (is.primitive(children[i])) children[i] = vnode(undefined, undefined, undefined, children[i], undefined)
    }
  }
  if (
    sel[0] === 's' && sel[1] === 'v' && sel[2] === 'g' &&
    (sel.length === 3 || sel[3] === '.' || sel[3] === '#')
  ) {
    addNS(data, children, sel)
  }
  // 返回一个vnode  一个含有固定属性的对象
  return vnode(sel, data, children, text, undefined)
};
