/* eslint-disable unicorn/prefer-dom-node-remove */
import type {
  AttrNamespace,
  Bounds,
  BrowserDOMEnvironment,
  Cursor,
  ElementBuilder,
  Environment,
  Maybe,
  Nullable,
  SimpleAttr,
  SimpleComment,
  SimpleElement,
  SimpleNode,
  SimpleText,
} from '@glimmer/interfaces';
import { assert, castToBrowser, castToSimple, COMMENT_NODE, expect, NS_SVG } from '@glimmer/util';

import { ConcreteBounds, CursorImpl } from '../bounds';

export const SERIALIZATION_FIRST_NODE_STRING = '%+b:0%';

export function isSerializationFirstNode(node: SimpleNode): boolean {
  return node.nodeValue === SERIALIZATION_FIRST_NODE_STRING;
}

export class RehydratingCursor
  extends CursorImpl<BrowserDOMEnvironment>
  implements Cursor<BrowserDOMEnvironment>
{
  candidate: Nullable<SimpleNode> = null;
  openBlockDepth: number;
  injectedOmittedNode = false;
  constructor(
    element: Element,
    nextSibling: Nullable<ChildNode>,
    public readonly startingBlockDepth: number
  ) {
    super(element, nextSibling);
    this.openBlockDepth = startingBlockDepth - 1;
  }
}

export class RehydrateBuilder
  extends NewElementBuilder<BrowserDOMEnvironment>
  implements ElementBuilder<BrowserDOMEnvironment>
{
  private unmatchedAttributes: Nullable<SimpleAttr[]> = null;
  blockDepth = 0;
  startingBlockOffset: number;

  constructor(
    environment: Environment,
    parentNode: SimpleElement,
    nextSibling: Nullable<SimpleNode>
  ) {
    super(environment, parentNode, nextSibling);
    if (nextSibling) throw new Error('Rehydration with nextSibling not supported');

    let node = this._currentCursor_!.element.firstChild;

    while (node !== null) {
      if (isOpenBlock(node)) {
        break;
      }
      node = node.nextSibling;
    }

    assert(node, 'Must have opening comment for rehydration.');
    this.candidate = node;
    let startingBlockOffset = getBlockDepth(node);
    if (startingBlockOffset === 0) {
      this.startingBlockOffset = 0;
    } else {
      // We are rehydrating from a partial tree and not the root component
      // We need to add an extra block before the first block to rehydrate correctly
      // The extra block is needed since the renderComponent API creates a synthetic component invocation which generates the extra block
      let newBlockDepth = startingBlockOffset - 1;
      let newCandidate = this._dom_.createComment(`%+b:${newBlockDepth}%`);

      node.parentNode!.insertBefore(newCandidate, this.candidate);
      let closingNode = node.nextSibling;
      while (closingNode !== null) {
        if (isCloseBlock(closingNode) && getBlockDepth(closingNode) === startingBlockOffset) {
          break;
        }
        closingNode = closingNode.nextSibling;
      }

      assert(closingNode, 'Must have closing comment for starting block comment');
      let newClosingBlock = this._dom_.createComment(`%-b:${newBlockDepth}%`);
      node.parentNode!.insertBefore(newClosingBlock, closingNode.nextSibling);
      this.candidate = newCandidate;
      this.startingBlockOffset = newBlockDepth;
    }
  }

  declare readonly _currentCursor_: Nullable<RehydratingCursor>;

  get candidate(): Nullable<SimpleNode> {
    if (this._currentCursor_) {
      return this._currentCursor_.candidate!;
    }

    return null;
  }

  set candidate(node: Nullable<SimpleNode>) {
    let currentCursor = this._currentCursor_!;

    currentCursor.candidate = node;
  }

  disableRehydration(nextSibling: Nullable<SimpleNode>) {
    let currentCursor = this._currentCursor_!;

    // rehydration will be disabled until we either:
    // * hit popElement (and return to using the parent elements cursor)
    // * hit closeBlock and the next sibling is a close block comment
    //   matching the expected openBlockDepth
    currentCursor.candidate = null;
    currentCursor.nextSibling = nextSibling;
  }

  enableRehydration(candidate: Nullable<SimpleNode>) {
    let currentCursor = this._currentCursor_!;

    currentCursor.candidate = candidate;
    currentCursor.nextSibling = null;
  }

  override pushElement(
    /** called from parent constructor before we initialize this */
    this:
      | RehydrateBuilder
      | (NewElementBuilder & Partial<Pick<RehydrateBuilder, 'blockDepth' | 'candidate'>>),
    element: SimpleElement,
    nextSibling: Maybe<SimpleNode> = null
  ) {
    let cursor = new RehydratingCursor(element, nextSibling, this.blockDepth || 0);

    /**
     * <div>   <---------------  currentCursor.element
     *   <!--%+b:1%--> <-------  would have been removed during openBlock
     *   <div> <---------------  currentCursor.candidate -> cursor.element
     *     <!--%+b:2%--> <-----  currentCursor.candidate.firstChild -> cursor.candidate
     *     Foo
     *     <!--%-b:2%-->
     *   </div>
     *   <!--%-b:1%-->  <------  becomes currentCursor.candidate
     */
    if (this.candidate !== null) {
      cursor.candidate = element.firstChild;
      this.candidate = element.nextSibling;
    }

    this._pushCursor_(cursor);
  }

  // clears until the end of the current container
  // either the current open block or higher
  private clearMismatch(candidate: SimpleNode) {
    let current: Nullable<SimpleNode> = candidate;
    let currentCursor = this._currentCursor_;
    if (currentCursor !== null) {
      let openBlockDepth = currentCursor.openBlockDepth;
      if (openBlockDepth >= currentCursor.startingBlockDepth) {
        while (current) {
          if (isCloseBlock(current)) {
            let closeBlockDepth = getBlockDepthWithOffset(current, this.startingBlockOffset);
            if (openBlockDepth >= closeBlockDepth) {
              break;
            }
          }
          current = this.remove(current);
        }
      } else {
        while (current !== null) {
          current = this.remove(current);
        }
      }
      // current cursor parentNode should be openCandidate if element
      // or openCandidate.parentNode if comment
      this.disableRehydration(current);
    }
  }

  override __openBlock(): void {
    let { _currentCursor_ } = this;
    if (_currentCursor_ === null) return;

    let blockDepth = this.blockDepth;

    this.blockDepth++;

    let { candidate } = _currentCursor_;
    if (candidate === null) return;

    let { tagName } = _currentCursor_.element;

    if (
      isOpenBlock(candidate) &&
      getBlockDepthWithOffset(candidate, this.startingBlockOffset) === blockDepth
    ) {
      this.candidate = this.remove(candidate);
      _currentCursor_.openBlockDepth = blockDepth;
    } else if (tagName !== 'TITLE' && tagName !== 'SCRIPT' && tagName !== 'STYLE') {
      this.clearMismatch(candidate);
    }
  }

  override __closeBlock(): void {
    let { _currentCursor_ } = this;
    if (_currentCursor_ === null) return;

    // openBlock is the last rehydrated open block
    let openBlockDepth = _currentCursor_.openBlockDepth;

    // this currently is the expected next open block depth
    this.blockDepth--;

    let { candidate } = _currentCursor_;

    let isRehydrating = false;

    if (candidate !== null) {
      isRehydrating = true;
      //assert(
      //  openBlockDepth === this.blockDepth,
      //  'when rehydrating, openBlockDepth should match this.blockDepth here'
      //);

      if (
        isCloseBlock(candidate) &&
        getBlockDepthWithOffset(candidate, this.startingBlockOffset) === openBlockDepth
      ) {
        let nextSibling = this.remove(candidate);
        this.candidate = nextSibling;
        _currentCursor_.openBlockDepth--;
      } else {
        // close the block and clear mismatch in parent container
        // we will be either at the end of the element
        // or at the end of our containing block
        this.clearMismatch(candidate);
        isRehydrating = false;
      }
    }

    if (isRehydrating === false) {
      // check if nextSibling matches our expected close block
      // if so, we remove the close block comment and
      // restore rehydration after clearMismatch disabled
      let nextSibling = _currentCursor_.nextSibling;
      if (
        nextSibling !== null &&
        isCloseBlock(nextSibling) &&
        getBlockDepthWithOffset(nextSibling, this.startingBlockOffset) === this.blockDepth
      ) {
        // restore rehydration state
        let candidate = this.remove(nextSibling);
        this.enableRehydration(candidate);

        _currentCursor_.openBlockDepth--;
      }
    }
  }

  override __appendNode(node: SimpleNode): SimpleNode {
    let { candidate } = this;

    // This code path is only used when inserting precisely one node. It needs more
    // comparison logic, but we can probably lean on the cases where this code path
    // is actually used.
    return candidate ?? super.__appendNode(node);
  }

  override __appendHTML(html: string): Bounds {
    let candidateBounds = this.markerBounds();

    if (candidateBounds) {
      let first = candidateBounds.firstNode()!;
      let last = candidateBounds.lastNode()!;

      let newBounds = new ConcreteBounds(this.element, first.nextSibling!, last.previousSibling!);

      let possibleEmptyMarker = this.remove(first);
      this.remove(last);

      if (possibleEmptyMarker !== null && isEmpty(possibleEmptyMarker)) {
        this.candidate = this.remove(possibleEmptyMarker);

        if (this.candidate !== null) {
          this.clearMismatch(this.candidate);
        }
      }

      return newBounds;
    } else {
      return super.__appendHTML(html);
    }
  }

  protected remove(node: SimpleNode): Nullable<SimpleNode> {
    let element = expect(node.parentNode, `cannot remove a detached node`) as SimpleElement;
    let next = node.nextSibling;
    element.removeChild(node);
    return next;
  }

  private markerBounds(): Nullable<Bounds> {
    let _candidate = this.candidate;

    if (_candidate && isMarker(_candidate)) {
      let first = _candidate;
      let last = expect(first.nextSibling, `BUG: serialization markers must be paired`);

      while (last && !isMarker(last)) {
        last = expect(last.nextSibling, `BUG: serialization markers must be paired`);
      }

      return new ConcreteBounds(this.element, first, last);
    } else {
      return null;
    }
  }

  override __appendText(string: string): SimpleText {
    let { candidate } = this;

    if (candidate) {
      if (isTextNode(candidate)) {
        if (candidate.nodeValue !== string) {
          candidate.nodeValue = string;
        }
        this.candidate = candidate.nextSibling;

        return candidate;
      } else if (isSeparator(candidate)) {
        this.candidate = this.remove(candidate);

        return this.__appendText(string);
      } else if (isEmpty(candidate) && string === '') {
        this.candidate = this.remove(candidate);

        return this.__appendText(string);
      } else {
        this.clearMismatch(candidate);

        return super.__appendText(string);
      }
    } else {
      return super.__appendText(string);
    }
  }

  override __appendComment(string: string): SimpleComment {
    let _candidate = this.candidate;
    if (_candidate && isComment(_candidate)) {
      if (_candidate.nodeValue !== string) {
        _candidate.nodeValue = string;
      }

      this.candidate = _candidate.nextSibling;
      return _candidate;
    } else if (_candidate) {
      this.clearMismatch(_candidate);
    }

    return super.__appendComment(string);
  }

  override __openElement(tag: string): SimpleElement {
    let _candidate = this.candidate;

    if (_candidate && isElement(_candidate) && isSameNodeType(_candidate, tag)) {
      this.unmatchedAttributes = Array.prototype.slice.call(_candidate.attributes);
      return _candidate;
    } else if (_candidate) {
      if (isElement(_candidate) && _candidate.tagName === 'TBODY') {
        this.pushElement(_candidate, null);
        this._currentCursor_!.injectedOmittedNode = true;
        return this.__openElement(tag);
      }
      this.clearMismatch(_candidate);
    }

    return super.__openElement(tag);
  }

  override __setAttribute(name: string, value: string, namespace: Nullable<AttrNamespace>): void {
    let unmatched = this.unmatchedAttributes;

    if (unmatched) {
      let attribute = findByName(unmatched, name);
      if (attribute) {
        if (attribute.value !== value) {
          attribute.value = value;
        }
        unmatched.splice(unmatched.indexOf(attribute), 1);
        return;
      }
    }

    return super.__setAttribute(name, value, namespace);
  }

  override __setProperty(name: string, value: string): void {
    let unmatched = this.unmatchedAttributes;

    if (unmatched) {
      let attribute = findByName(unmatched, name);
      if (attribute) {
        if (attribute.value !== value) {
          attribute.value = value;
        }
        unmatched.splice(unmatched.indexOf(attribute), 1);
        return;
      }
    }

    return super.__setProperty(name, value);
  }

  override __flushElement(parent: SimpleElement, constructing: SimpleElement): void {
    let { unmatchedAttributes: unmatched } = this;
    if (unmatched) {
      for (let attribute of unmatched) {
        this._constructing_.removeAttribute(attribute.name);
      }
      this.unmatchedAttributes = null;
    } else {
      super.__flushElement(parent, constructing);
    }
  }

  override willCloseElement() {
    let { candidate, _currentCursor_ } = this;

    if (candidate !== null) {
      this.clearMismatch(candidate);
    }

    if (_currentCursor_ && _currentCursor_.injectedOmittedNode) {
      this.popElement();
    }

    super.willCloseElement();
  }

  getMarker(element: HTMLElement, guid: string): Nullable<SimpleNode> {
    let marker = element.querySelector(`script[glmr="${guid}"]`);
    if (marker) {
      return castToSimple(marker);
    }
    return null;
  }

  override __pushRemoteElement(
    element: SimpleElement,
    cursorId: string,
    insertBefore: Maybe<SimpleNode>
  ): Nullable<RemoteLiveBlock> {
    let marker = this.getMarker(castToBrowser(element, 'HTML'), cursorId);

    assert(
      !marker || marker.parentNode === element,
      `expected remote element marker's parent node to match remote element`
    );

    // when insertBefore is not present, we clear the element
    if (insertBefore === undefined) {
      while (element.firstChild !== null && element.firstChild !== marker) {
        this.remove(element.firstChild);
      }
      insertBefore = null;
    }

    let cursor = new RehydratingCursor(element, null, this.blockDepth);
    this._pushCursor_(cursor);

    if (marker === null) {
      this.disableRehydration(insertBefore);
    } else {
      this.candidate = this.remove(marker);
    }

    let block = new RemoteLiveBlock(element);
    return this.pushLiveBlock(block, true);
  }

  override didAppendBounds(bounds: Bounds): Bounds {
    super.didAppendBounds(bounds);
    if (this.candidate) {
      let last = bounds.lastNode();
      this.candidate = last && last.nextSibling;
    }
    return bounds;
  }
}

function isTextNode(node: SimpleNode): node is SimpleText {
  return node.nodeType === 3;
}

function isComment(node: SimpleNode): node is SimpleComment {
  return node.nodeType === 8;
}

function isOpenBlock(node: SimpleNode): node is SimpleComment;
function isOpenBlock(node: ChildNode): node is Comment;
function isOpenBlock(node: SimpleNode | ChildNode): node is SimpleComment | Comment;
function isOpenBlock(node: SimpleNode | ChildNode): node is SimpleComment | Comment {
  return node.nodeType === COMMENT_NODE && node.nodeValue?.lastIndexOf('%+b:', 0) === 0;
}

function isCloseBlock(node: SimpleNode): node is SimpleComment {
  return node.nodeType === COMMENT_NODE && node.nodeValue.lastIndexOf('%-b:', 0) === 0;
}

function getBlockDepth(node: SimpleComment): number {
  return Number.parseInt(node.nodeValue.slice(4), 10);
}

function getBlockDepthWithOffset(node: SimpleComment, offset: number): number {
  return getBlockDepth(node) - offset;
}

function isElement(node: SimpleNode): node is SimpleElement {
  return node.nodeType === 1;
}

function isMarker(node: SimpleNode): boolean {
  return node.nodeType === 8 && node.nodeValue === '%glmr%';
}

function isSeparator(node: SimpleNode): boolean {
  return node.nodeType === 8 && node.nodeValue === '%|%';
}

function isEmpty(node: SimpleNode): boolean {
  return node.nodeType === 8 && node.nodeValue === '% %';
}

function isSameNodeType(candidate: SimpleElement, tag: string) {
  if (candidate.namespaceURI === NS_SVG) {
    return candidate.tagName === tag;
  }
  return candidate.tagName === tag.toUpperCase();
}

function findByName(array: SimpleAttr[], name: string): SimpleAttr | undefined {
  for (let attribute of array) {
    if (attribute.name === name) return attribute;
  }

  return undefined;
}

export function rehydrationBuilder(environment: Environment, cursor: CursorImpl): ElementBuilder {
  return RehydrateBuilder.forInitialRender(environment, cursor);
}
