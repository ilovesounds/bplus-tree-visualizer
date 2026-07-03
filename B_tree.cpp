#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

static constexpr int ORDER = 3;
static constexpr int MAX_KEYS = ORDER - 1;
static constexpr int MIN_LEAF_KEYS = (MAX_KEYS + 1) / 2;
static constexpr int MIN_INTERNAL_CHILDREN = (ORDER + 1) / 2;
static constexpr int MIN_INTERNAL_KEYS = MIN_INTERNAL_CHILDREN - 1;

struct Node {
    bool is_leaf;
    int key_count;
    int keys[ORDER];           
    Node* children[ORDER + 1]; 
    int values[ORDER];         
    Node* next;
    Node* parent;

    Node(bool leaf) : is_leaf(leaf), key_count(0), next(nullptr), parent(nullptr) {
        for (int i = 0; i < ORDER + 1; ++i) children[i] = nullptr;
    }
};

class BPlusTree {
    Node* root;

    int minKeysFor(Node* node) {
        if (node->is_leaf) {
            return MIN_LEAF_KEYS;
        }
        return MIN_INTERNAL_KEYS;
    }

    Node* findLeaf(int key) {
        Node* cur = root;
        while (!cur->is_leaf) {
            int i = 0;
            while (i < cur->key_count && key >= cur->keys[i]) {
                i++;
            }
            cur = cur->children[i];
        }
        return cur;
    }

    void insertIntoLeaf(Node* leaf, int key, int value) {
        
        for (int i = 0; i < leaf->key_count; ++i) {
            if (leaf->keys[i] == key) {
                leaf->values[i] = value;
                return;
            }
        }

        int i = leaf->key_count - 1;
        while (i >= 0 && leaf->keys[i] > key) {
            leaf->keys[i + 1] = leaf->keys[i];
            leaf->values[i + 1] = leaf->values[i];
            i--;
        }
        leaf->keys[i + 1] = key;
        leaf->values[i + 1] = value;
        leaf->key_count++;
    }

    void insertIntoParent(Node* left, int key, Node* right) {
        Node* parent = left->parent;

        if (parent == nullptr) {
            Node* newRoot = new Node(false);
            newRoot->keys[0] = key;
            newRoot->children[0] = left;
            newRoot->children[1] = right;
            newRoot->key_count = 1;
            left->parent = newRoot;
            right->parent = newRoot;
            root = newRoot;
            return;
        }

        int idx = 0;
        while (parent->children[idx] != left) {
            idx++;
        }

        for (int i = parent->key_count; i > idx; --i) {
            parent->keys[i] = parent->keys[i - 1];
        }
        for (int i = parent->key_count + 1; i > idx + 1; --i) {
            parent->children[i] = parent->children[i - 1];
        }
        parent->keys[idx] = key;
        parent->children[idx + 1] = right;
        parent->key_count++;
        right->parent = parent;

        if (parent->key_count > MAX_KEYS) {
            splitInternal(parent);
        }
    }

    void splitLeaf(Node* leaf) {
        int total = leaf->key_count;
        int leftCount = (total + 1) / 2;
        int rightCount = total - leftCount;

        Node* newLeaf = new Node(true);
        newLeaf->key_count = rightCount;
        for (int i = 0; i < rightCount; ++i) {
            newLeaf->keys[i] = leaf->keys[leftCount + i];
            newLeaf->values[i] = leaf->values[leftCount + i];
        }
        leaf->key_count = leftCount;

        newLeaf->next = leaf->next;
        leaf->next = newLeaf;
        newLeaf->parent = leaf->parent;

        int promotedKey = newLeaf->keys[0];
        insertIntoParent(leaf, promotedKey, newLeaf);
    }

    void splitInternal(Node* node) {
        int total = node->key_count;
        int mid = total / 2;
        int promotedKey = node->keys[mid];

        Node* newNode = new Node(false);
        int rightKeyCount = total - mid - 1;
        for (int i = 0; i < rightKeyCount; ++i) {
            newNode->keys[i] = node->keys[mid + 1 + i];
        }
        int rightChildCount = rightKeyCount + 1;
        for (int i = 0; i < rightChildCount; ++i) {
            newNode->children[i] = node->children[mid + 1 + i];
            newNode->children[i]->parent = newNode;
        }
        newNode->key_count = rightKeyCount;
        node->key_count = mid;

        insertIntoParent(node, promotedKey, newNode);
    }

    bool removeFromLeaf(Node* leaf, int key) {
        int idx = -1;
        for (int i = 0; i < leaf->key_count; ++i) {
            if (leaf->keys[i] == key) {
                idx = i;
                break;
            }
        }
        if (idx == -1) {
            return false;
        }
        for (int i = idx; i < leaf->key_count - 1; ++i) {
            leaf->keys[i] = leaf->keys[i + 1];
            leaf->values[i] = leaf->values[i + 1];
        }
        leaf->key_count--;
        return true;
    }

    void borrowFromLeftLeaf(Node* node, Node* leftSibling, Node* parent, int idx) {
        for (int i = node->key_count; i > 0; --i) {
            node->keys[i] = node->keys[i - 1];
            node->values[i] = node->values[i - 1];
        }
        node->keys[0] = leftSibling->keys[leftSibling->key_count - 1];
        node->values[0] = leftSibling->values[leftSibling->key_count - 1];
        node->key_count++;
        leftSibling->key_count--;
        parent->keys[idx - 1] = node->keys[0];
    }

    void borrowFromRightLeaf(Node* node, Node* rightSibling, Node* parent, int idx) {
        node->keys[node->key_count] = rightSibling->keys[0];
        node->values[node->key_count] = rightSibling->values[0];
        node->key_count++;

        for (int i = 0; i < rightSibling->key_count - 1; ++i) {
            rightSibling->keys[i] = rightSibling->keys[i + 1];
            rightSibling->values[i] = rightSibling->values[i + 1];
        }
        rightSibling->key_count--;
        parent->keys[idx] = rightSibling->keys[0];
    }

    void borrowFromLeftInternal(Node* node, Node* leftSibling, Node* parent, int idx) {
        for (int i = node->key_count; i > 0; --i) {
            node->keys[i] = node->keys[i - 1];
        }
        for (int i = node->key_count + 1; i > 0; --i) {
            node->children[i] = node->children[i - 1];
        }
        node->keys[0] = parent->keys[idx - 1];
        node->children[0] = leftSibling->children[leftSibling->key_count];
        node->children[0]->parent = node;
        node->key_count++;

        parent->keys[idx - 1] = leftSibling->keys[leftSibling->key_count - 1];
        leftSibling->key_count--;
    }

    void borrowFromRightInternal(Node* node, Node* rightSibling, Node* parent, int idx) {
        node->keys[node->key_count] = parent->keys[idx];
        node->children[node->key_count + 1] = rightSibling->children[0];
        node->children[node->key_count + 1]->parent = node;
        node->key_count++;

        parent->keys[idx] = rightSibling->keys[0];

        for (int i = 0; i < rightSibling->key_count - 1; ++i) {
            rightSibling->keys[i] = rightSibling->keys[i + 1];
        }
        for (int i = 0; i < rightSibling->key_count; ++i) {
            rightSibling->children[i] = rightSibling->children[i + 1];
        }
        rightSibling->key_count--;
    }

    void removeFromParent(Node* parent, int sepIdx) {
        for (int i = sepIdx; i < parent->key_count - 1; ++i) {
            parent->keys[i] = parent->keys[i + 1];
        }
        for (int i = sepIdx + 1; i < parent->key_count; ++i) {
            parent->children[i] = parent->children[i + 1];
        }
        parent->key_count--;
    }

    void mergeLeaves(Node* left, Node* right, Node* parent, int sepIdx) {
        for (int i = 0; i < right->key_count; ++i) {
            left->keys[left->key_count + i] = right->keys[i];
            left->values[left->key_count + i] = right->values[i];
        }
        left->key_count += right->key_count;
        left->next = right->next;

        removeFromParent(parent, sepIdx);
        delete right;
    }

    void mergeInternal(Node* left, Node* right, Node* parent, int sepIdx) {
        int oldLeftCount = left->key_count;
        left->keys[oldLeftCount] = parent->keys[sepIdx];

        for (int i = 0; i < right->key_count; ++i) {
            left->keys[oldLeftCount + 1 + i] = right->keys[i];
        }
        for (int i = 0; i <= right->key_count; ++i) {
            left->children[oldLeftCount + 1 + i] = right->children[i];
            left->children[oldLeftCount + 1 + i]->parent = left;
        }
        left->key_count = oldLeftCount + 1 + right->key_count;

        removeFromParent(parent, sepIdx);
        delete right;
    }

    void rebalance(Node* node) {
        if (node == root) {
            if (!root->is_leaf && root->key_count == 0) {
                Node* oldRoot = root;
                root = root->children[0];
                root->parent = nullptr;
                delete oldRoot;
            }
            return;
        }

        if (node->key_count >= minKeysFor(node)) {
            return;
        }

        Node* parent = node->parent;
        int idx = 0;
        while (parent->children[idx] != node) {
            idx++;
        }

        Node* leftSibling = nullptr;
        Node* rightSibling = nullptr;
        if (idx > 0) {
            leftSibling = parent->children[idx - 1];
        }
        if (idx < parent->key_count) {
            rightSibling = parent->children[idx + 1];
        }

        if (leftSibling != nullptr && leftSibling->key_count > minKeysFor(leftSibling)) {
            if (node->is_leaf) {
                borrowFromLeftLeaf(node, leftSibling, parent, idx);
            } else {
                borrowFromLeftInternal(node, leftSibling, parent, idx);
            }
            return;
        }

        if (rightSibling != nullptr && rightSibling->key_count > minKeysFor(rightSibling)) {
            if (node->is_leaf) {
                borrowFromRightLeaf(node, rightSibling, parent, idx);
            } else {
                borrowFromRightInternal(node, rightSibling, parent, idx);
            }
            return;
        }

        if (leftSibling != nullptr) {
            if (node->is_leaf) {
                mergeLeaves(leftSibling, node, parent, idx - 1);
            } else {
                mergeInternal(leftSibling, node, parent, idx - 1);
            }
        } else {
            if (node->is_leaf) {
                mergeLeaves(node, rightSibling, parent, idx);
            } else {
                mergeInternal(node, rightSibling, parent, idx);
            }
        }

        rebalance(parent);
    }

    void deleteSubtree(Node* node) {
        if (node == nullptr) {
            return;
        }
        if (!node->is_leaf) {
            for (int i = 0; i <= node->key_count; ++i) {
                deleteSubtree(node->children[i]);
            }
        }
        delete node;
    }

public:
    BPlusTree() : root(new Node(true)) {}

    ~BPlusTree() {
        deleteSubtree(root);
    }

    void insert(int key, int value) {
        Node* leaf = findLeaf(key);
        insertIntoLeaf(leaf, key, value);
        if (leaf->key_count > MAX_KEYS) {
            splitLeaf(leaf);
        }
    }

    void remove(int key) {
        Node* leaf = findLeaf(key);
        bool removed = removeFromLeaf(leaf, key);
        if (!removed) {
           cout << "Key " << key << " not found." <<endl;
            return;
        }
        rebalance(leaf);
    }

    bool search(int key) {
        Node* leaf = findLeaf(key);
        for (int i = 0; i < leaf->key_count; ++i) {
            if (leaf->keys[i] == key) {
                return true;
            }
        }
        return false;
    }

    void printLeaves() {
        Node* cur = root;
        while (!cur->is_leaf) {
            cur = cur->children[0];
        }
        while (cur != nullptr) {
            for (int i = 0; i < cur->key_count; ++i) {
               cout << "(" << cur->keys[i] << "," << cur->values[i] << ") ";
            }
            cur = cur->next;
        }
       cout <<endl;
    }
};

int main() {
    BPlusTree tree;

    int keys[] = {10, 20, 5, 6, 12, 30, 7, 17, 3, 25, 1, 8};
    for (int i = 0; i < 12; ++i) {
        tree.insert(keys[i], keys[i] * 100);
    }

   cout << "After inserts: ";
    tree.printLeaves();

    tree.remove(6);
    tree.remove(12);
    tree.remove(30);

   cout << "After removes: ";
    tree.printLeaves();

   cout << "Search 17: " << tree.search(17) <<endl;
   cout << "Search 12: " << tree.search(12) <<endl;

    return 0;
}