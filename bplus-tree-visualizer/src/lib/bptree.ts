export type OperationType = 'insert' | 'remove' | 'search' | 'split' | 'merge' | 'borrow';

export interface OperationLog {
  id: number;
  type: OperationType;
  message: string;
  nodeIds: number[];
  timestamp: number;
  snapshot?: BPTreeNode | null;
  highlightedNodes?: Set<number>;
}

// A node ID generator to uniquely identify nodes for UI animations
let nextNodeId = 1;

export class BPTreeNode {
  id: number;
  isLeaf: boolean;
  keys: number[];
  values: number[];
  children: BPTreeNode[];
  next: BPTreeNode | null;
  parent: BPTreeNode | null;

  constructor(isLeaf: boolean) {
    this.id = nextNodeId++;
    this.isLeaf = isLeaf;
    this.keys = [];
    this.values = [];
    this.children = [];
    this.next = null;
    this.parent = null;
  }
}

export class BPlusTree {
  root: BPTreeNode;
  order: number;
  maxKeys: number;
  minLeafKeys: number;
  minInternalChildren: number;
  minInternalKeys: number;
  
  logs: OperationLog[] = [];
  private logId = 1;
  private currentOpNodes: Set<number> = new Set(); // For highlighting

  constructor(order: number = 3) {
    this.order = order;
    this.maxKeys = order - 1;
    this.minLeafKeys = Math.floor((this.maxKeys + 1) / 2);
    this.minInternalChildren = Math.floor((order + 1) / 2);
    this.minInternalKeys = this.minInternalChildren - 1;
    this.root = new BPTreeNode(true);
  }

  log(type: OperationType, message: string, nodes: BPTreeNode[] = []) {
    nodes.forEach(n => this.currentOpNodes.add(n.id));
    this.logs.unshift({
      id: this.logId++,
      type,
      message,
      nodeIds: nodes.map(n => n.id),
      timestamp: Date.now(),
      snapshot: this.cloneTree(),
      highlightedNodes: new Set(this.currentOpNodes)
    });
  }

  cloneTree(): BPTreeNode | null {
    if (!this.root) return null;
    const nodeMap = new Map<number, BPTreeNode>();
    
    const cloneNode = (node: BPTreeNode): BPTreeNode => {
      let clone = new BPTreeNode(node.isLeaf);
      clone.id = node.id;
      clone.keys = [...node.keys];
      clone.values = [...node.values];
      nodeMap.set(node.id, clone);
      clone.children = node.children.map(cloneNode);
      return clone;
    };
    
    let clonedRoot = cloneNode(this.root);
    
    // Fix next pointers (only needed for leaf chain)
    const traverseAndFix = (node: BPTreeNode) => {
      if (node.next) {
        let clonedNode = nodeMap.get(node.id);
        let clonedNext = nodeMap.get(node.next.id);
        if (clonedNode && clonedNext) {
          clonedNode.next = clonedNext;
        }
      }
      node.children.forEach(traverseAndFix);
    };
    traverseAndFix(this.root);
    
    return clonedRoot;
  }

  clearLogs() {
    this.logs = [];
    this.currentOpNodes.clear();
  }
  
  clearOpHighlight() {
      this.currentOpNodes.clear();
  }
  
  getHighlightedNodes(): Set<number> {
      return this.currentOpNodes;
  }

  private minKeysFor(node: BPTreeNode): number {
    return node.isLeaf ? this.minLeafKeys : this.minInternalKeys;
  }

  private findLeaf(key: number): BPTreeNode {
    let cur = this.root;
    while (!cur.isLeaf) {
      let i = 0;
      while (i < cur.keys.length && key >= cur.keys[i]) {
        i++;
      }
      cur = cur.children[i];
    }
    return cur;
  }

  insert(key: number, value: number) {
    this.clearOpHighlight();
    this.log('insert', `Inserting key ${key}`, []);
    let leaf = this.findLeaf(key);
    this.insertIntoLeaf(leaf, key, value);
    if (leaf.keys.length > this.maxKeys) {
      this.splitLeaf(leaf);
    }
  }

  private insertIntoLeaf(leaf: BPTreeNode, key: number, value: number) {
    let i = 0;
    while (i < leaf.keys.length && leaf.keys[i] < key) {
      i++;
    }
    if (i < leaf.keys.length && leaf.keys[i] === key) {
      leaf.values[i] = value;
      this.log('insert', `Updated value for key ${key}`, [leaf]);
      return;
    }
    leaf.keys.splice(i, 0, key);
    leaf.values.splice(i, 0, value);
    this.log('insert', `Inserted key ${key} into leaf`, [leaf]);
  }

  private insertIntoParent(left: BPTreeNode, key: number, right: BPTreeNode) {
    let parent = left.parent;
    if (!parent) {
      let newRoot = new BPTreeNode(false);
      newRoot.keys.push(key);
      newRoot.children.push(left, right);
      left.parent = newRoot;
      right.parent = newRoot;
      this.root = newRoot;
      this.log('split', `Created new root with key ${key}`, [newRoot]);
      return;
    }

    let idx = parent.children.indexOf(left);
    parent.keys.splice(idx, 0, key);
    parent.children.splice(idx + 1, 0, right);
    right.parent = parent;

    this.log('insert', `Inserted key ${key} into internal node`, [parent]);

    if (parent.keys.length > this.maxKeys) {
      this.splitInternal(parent);
    }
  }

  private splitLeaf(leaf: BPTreeNode) {
    let total = leaf.keys.length;
    let leftCount = Math.floor((total + 1) / 2);

    let newLeaf = new BPTreeNode(true);
    newLeaf.keys = leaf.keys.splice(leftCount);
    newLeaf.values = leaf.values.splice(leftCount);
    
    newLeaf.next = leaf.next;
    leaf.next = newLeaf;
    newLeaf.parent = leaf.parent;

    let promotedKey = newLeaf.keys[0];
    this.log('split', `Split leaf node, promoting key ${promotedKey}`, [leaf, newLeaf]);
    this.insertIntoParent(leaf, promotedKey, newLeaf);
  }

  private splitInternal(node: BPTreeNode) {
    let total = node.keys.length;
    let mid = Math.floor(total / 2);
    let promotedKey = node.keys[mid];

    let newNode = new BPTreeNode(false);
    newNode.keys = node.keys.splice(mid + 1);
    node.keys.pop(); // Remove the promoted key from left node
    newNode.children = node.children.splice(mid + 1);
    
    newNode.children.forEach(child => child.parent = newNode);

    this.log('split', `Split internal node, promoting key ${promotedKey}`, [node, newNode]);
    this.insertIntoParent(node, promotedKey, newNode);
  }

  search(key: number): boolean {
    this.clearOpHighlight();
    let leaf = this.findLeaf(key);
    for (let i = 0; i < leaf.keys.length; ++i) {
      if (leaf.keys[i] === key) {
        this.log('search', `Found key ${key}`, [leaf]);
        return true;
      }
    }
    this.log('search', `Key ${key} not found`, [leaf]);
    return false;
  }

  remove(key: number) {
    this.clearOpHighlight();
    this.log('remove', `Removing key ${key}`, []);
    let leaf = this.findLeaf(key);
    let idx = leaf.keys.indexOf(key);
    if (idx === -1) {
      this.log('remove', `Key ${key} not found for removal`, [leaf]);
      return;
    }
    
    leaf.keys.splice(idx, 1);
    leaf.values.splice(idx, 1);
    this.log('remove', `Removed key ${key} from leaf`, [leaf]);

    if (idx === 0 && leaf.keys.length > 0) {
      let cur = leaf.parent;
      while (cur) {
        let pIdx = cur.keys.indexOf(key);
        if (pIdx !== -1) {
          cur.keys[pIdx] = leaf.keys[0];
          this.log('remove', `Updated stale routing key ${key} to ${leaf.keys[0]}`, [cur]);
          break;
        }
        cur = cur.parent;
      }
    }
    
    this.rebalance(leaf);
  }

  private borrowFromLeftLeaf(node: BPTreeNode, leftSibling: BPTreeNode, parent: BPTreeNode, idx: number) {
    let borrowedKey = leftSibling.keys.pop()!;
    let borrowedVal = leftSibling.values.pop()!;
    node.keys.unshift(borrowedKey);
    node.values.unshift(borrowedVal);
    parent.keys[idx - 1] = node.keys[0];
    this.log('borrow', `Leaf borrowed key ${borrowedKey} from left sibling`, [node, leftSibling, parent]);
  }

  private borrowFromRightLeaf(node: BPTreeNode, rightSibling: BPTreeNode, parent: BPTreeNode, idx: number) {
    let borrowedKey = rightSibling.keys.shift()!;
    let borrowedVal = rightSibling.values.shift()!;
    node.keys.push(borrowedKey);
    node.values.push(borrowedVal);
    parent.keys[idx] = rightSibling.keys[0];
    this.log('borrow', `Leaf borrowed key ${borrowedKey} from right sibling`, [node, rightSibling, parent]);
  }

  private borrowFromLeftInternal(node: BPTreeNode, leftSibling: BPTreeNode, parent: BPTreeNode, idx: number) {
    let borrowedKey = leftSibling.keys.pop()!;
    let borrowedChild = leftSibling.children.pop()!;
    borrowedChild.parent = node;
    
    node.keys.unshift(parent.keys[idx - 1]);
    node.children.unshift(borrowedChild);
    parent.keys[idx - 1] = borrowedKey;
    this.log('borrow', `Internal node borrowed key ${borrowedKey} from left sibling`, [node, leftSibling, parent]);
  }

  private borrowFromRightInternal(node: BPTreeNode, rightSibling: BPTreeNode, parent: BPTreeNode, idx: number) {
    let borrowedKey = rightSibling.keys.shift()!;
    let borrowedChild = rightSibling.children.shift()!;
    borrowedChild.parent = node;
    
    node.keys.push(parent.keys[idx]);
    node.children.push(borrowedChild);
    parent.keys[idx] = borrowedKey;
    this.log('borrow', `Internal node borrowed key ${borrowedKey} from right sibling`, [node, rightSibling, parent]);
  }

  private mergeLeaves(left: BPTreeNode, right: BPTreeNode, parent: BPTreeNode, sepIdx: number) {
    left.keys.push(...right.keys);
    left.values.push(...right.values);
    left.next = right.next;
    parent.keys.splice(sepIdx, 1);
    parent.children.splice(sepIdx + 1, 1);
    this.log('merge', `Merged leaf nodes`, [left, parent]);
  }

  private mergeInternal(left: BPTreeNode, right: BPTreeNode, parent: BPTreeNode, sepIdx: number) {
    left.keys.push(parent.keys[sepIdx]);
    left.keys.push(...right.keys);
    right.children.forEach(c => c.parent = left);
    left.children.push(...right.children);
    
    parent.keys.splice(sepIdx, 1);
    parent.children.splice(sepIdx + 1, 1);
    this.log('merge', `Merged internal nodes`, [left, parent]);
  }

  private rebalance(node: BPTreeNode) {
    if (node === this.root) {
      if (!this.root.isLeaf && this.root.keys.length === 0) {
        this.root = this.root.children[0];
        this.root.parent = null;
        this.log('merge', `Root collapsed`, [this.root]);
      }
      return;
    }

    if (node.keys.length >= this.minKeysFor(node)) {
      return;
    }

    let parent = node.parent!;
    let idx = parent.children.indexOf(node);

    let leftSibling = idx > 0 ? parent.children[idx - 1] : null;
    let rightSibling = idx < parent.keys.length ? parent.children[idx + 1] : null;

    if (leftSibling && leftSibling.keys.length > this.minKeysFor(leftSibling)) {
      if (node.isLeaf) this.borrowFromLeftLeaf(node, leftSibling, parent, idx);
      else this.borrowFromLeftInternal(node, leftSibling, parent, idx);
      return;
    }

    if (rightSibling && rightSibling.keys.length > this.minKeysFor(rightSibling)) {
      if (node.isLeaf) this.borrowFromRightLeaf(node, rightSibling, parent, idx);
      else this.borrowFromRightInternal(node, rightSibling, parent, idx);
      return;
    }

    if (leftSibling) {
      if (node.isLeaf) this.mergeLeaves(leftSibling, node, parent, idx - 1);
      else this.mergeInternal(leftSibling, node, parent, idx - 1);
      this.rebalance(parent);
    } else if (rightSibling) {
      if (node.isLeaf) this.mergeLeaves(node, rightSibling, parent, idx);
      else this.mergeInternal(node, rightSibling, parent, idx);
      this.rebalance(parent);
    }
  }

  getTreeState() {
    return {
      root: this.root,
      logs: [...this.logs]
    };
  }
}
