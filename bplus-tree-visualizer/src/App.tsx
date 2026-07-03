import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { BPlusTree, BPTreeNode } from './lib/bptree';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Slider } from './components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { ArrowRight, Play, RotateCcw, Search, Trash, Plus, Code, LayoutDashboard } from 'lucide-react';
import cppSource from './B_tree.cpp?raw';

function LineOverlay({ edges, renderCounter }: { edges: {start: string, end: string}[], renderCounter: number }) {
  const [lines, setLines] = useState<{x1: number, y1: number, x2: number, y2: number}[]>([]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const container = document.getElementById('tree-container');
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const scale = containerRect.width / container.offsetWidth || 1;

      const newLines = edges.map(edge => {
        const startEl = document.getElementById(edge.start);
        const endEl = document.getElementById(edge.end);
        if (!startEl || !endEl) return null;
        
        const startRect = startEl.getBoundingClientRect();
        const endRect = endEl.getBoundingClientRect();

        return {
          x1: (startRect.left - containerRect.left) / scale + startEl.offsetWidth / 2,
          y1: (startRect.bottom - containerRect.top) / scale,
          x2: (endRect.left - containerRect.left) / scale + endEl.offsetWidth / 2,
          y2: (endRect.top - containerRect.top) / scale
        };
      }).filter(Boolean) as any[];
      
      setLines(newLines);
    }, 50);
    
    return () => clearTimeout(timeoutId);
  }, [edges, renderCounter]);

  return (
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
      {lines.map((line, i) => (
        <line key={i} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="white" strokeWidth={2} />
      ))}
    </svg>
  );
}

function Visualizer({ tree, order, setOrder, setTree, triggerRender, renderCounter }: any) {
  const [inputValue, setInputValue] = useState('');
  const [inputValValue, setInputValValue] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000);
  const playbackSpeedRef = useRef(playbackSpeed);
  useEffect(() => { playbackSpeedRef.current = playbackSpeed; }, [playbackSpeed]);
  
  const [displayRoot, setDisplayRoot] = useState<BPTreeNode | null>(tree.root);
  const [displayHighlights, setDisplayHighlights] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!isAnimating) {
      setDisplayRoot(tree.root);
      setDisplayHighlights(tree.getHighlightedNodes());
    }
  }, [tree.root, renderCounter, isAnimating, tree]);

  const playAnimation = async (newLogs: any[]) => {
    if (newLogs.length === 0) return;
    setIsAnimating(true);
    const steps = [...newLogs].reverse();
    for (const step of steps) {
      if (step.snapshot) setDisplayRoot(step.snapshot);
      if (step.highlightedNodes) setDisplayHighlights(step.highlightedNodes);
      triggerRender();
      await new Promise(r => setTimeout(r, playbackSpeedRef.current));
    }
    setDisplayRoot(tree.root);
    setDisplayHighlights(tree.getHighlightedNodes());
    triggerRender();
    setIsAnimating(false);
  };

  const handleInsert = async () => {
    if (!inputValue || isAnimating) return;
    const key = parseInt(inputValue);
    if (isNaN(key)) return;
    const val = inputValValue ? parseInt(inputValValue) : key * 100;
    
    const startLen = tree.logs.length;
    tree.insert(key, val);
    const endLen = tree.logs.length;
    
    setInputValue('');
    setInputValValue('');
    await playAnimation(tree.logs.slice(0, endLen - startLen));
  };

  const handleRemove = async () => {
    if (!inputValue || isAnimating) return;
    const key = parseInt(inputValue);
    if (isNaN(key)) return;
    
    const startLen = tree.logs.length;
    tree.remove(key);
    const endLen = tree.logs.length;
    
    setInputValue('');
    await playAnimation(tree.logs.slice(0, endLen - startLen));
  };

  const handleSearch = async () => {
    if (!inputValue || isAnimating) return;
    const key = parseInt(inputValue);
    if (isNaN(key)) return;
    
    const startLen = tree.logs.length;
    tree.search(key);
    const endLen = tree.logs.length;
    
    setInputValue('');
    await playAnimation(tree.logs.slice(0, endLen - startLen));
  };

  const handleClear = () => {
    if (isAnimating) return;
    setTree(new BPlusTree(order));
    triggerRender();
  };

  const highlightedNodes = displayHighlights;

  // BFS to get nodes by level for rendering
  const getLevels = () => {
    const levels: BPTreeNode[][] = [];
    if (!displayRoot) return levels;
    let currentLevel = [displayRoot];
    while (currentLevel.length > 0) {
      levels.push(currentLevel);
      let nextLevel: BPTreeNode[] = [];
      for (const node of currentLevel) {
        if (!node.isLeaf) {
          nextLevel.push(...node.children);
        }
      }
      currentLevel = nextLevel;
    }
    return levels;
  };

  const levels = getLevels();

  const getEdges = () => {
    const edges: { start: string; end: string }[] = [];
    if (!displayRoot) return edges;
    let currentLevel = [displayRoot];
    while (currentLevel.length > 0) {
      let nextLevel: BPTreeNode[] = [];
      for (const node of currentLevel) {
        if (!node.isLeaf) {
          for (const child of node.children) {
            edges.push({ start: `node-${node.id}`, end: `node-${child.id}` });
          }
          nextLevel.push(...node.children);
        }
      }
      currentLevel = nextLevel;
    }
    return edges;
  };

  const edges = getEdges();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1 overflow-hidden h-full">
      {/* Left Column: Visualization (Big) */}
      <div className="lg:col-span-2 xl:col-span-3 flex flex-col gap-4 h-[60vh] lg:h-full">
        <Card className="bg-zinc-900 border-zinc-800 flex-1 flex flex-col overflow-hidden">
          <CardHeader className="shrink-0 pb-2 border-b border-zinc-800/50 flex flex-row items-center justify-between">
            <CardTitle className="text-zinc-200 flex items-center gap-2">
              <Play className="w-4 h-4 text-indigo-400" />
              Live Tree Visualization
            </CardTitle>
            {isAnimating && (
              <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium animate-pulse">
                <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                Animating...
              </div>
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0 relative bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px] cursor-grab active:cursor-grabbing">
            <TransformWrapper 
              initialScale={1} 
              minScale={0.1} 
              maxScale={4}
              centerOnInit={true}
              wheel={{ step: 0.1 }}
            >
              <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%" }}>
                  <div id="tree-container" className="min-w-max min-h-max p-12 flex flex-col items-center gap-16 mx-auto mt-8 relative">
                    <LineOverlay edges={edges} renderCounter={renderCounter} />
                    {levels.map((level, levelIdx) => (
                      <div key={`level-${levelIdx}`} className="flex items-center gap-8 relative">
                        {level.map((node) => (
                          <div key={node.id} className="flex items-center">
                            <div id={`node-${node.id}`} className={`
                            flex flex-col bg-zinc-950 border-2 rounded-lg shadow-xl overflow-hidden transition-all duration-300
                            ${highlightedNodes.has(node.id) ? 'border-indigo-500 shadow-indigo-500/20 scale-105 z-10' : 'border-zinc-700'}
                          `}>
                            <div className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 text-center ${node.isLeaf ? 'bg-violet-900/40 text-violet-300' : 'bg-zinc-800 text-zinc-400'}`}>
                              {node.isLeaf ? 'Leaf Node' : 'Internal Node'}
                            </div>
                            <div className="flex divide-x divide-zinc-700 p-1">
                              {node.keys.map((key, i) => (
                                <div key={i} className="px-3 py-2 text-center min-w-[40px]">
                                  <div className="font-mono text-zinc-100">{key}</div>
                                  {node.isLeaf && (
                                    <div className="text-xs text-zinc-500 font-mono mt-1">v:{node.values[i]}</div>
                                  )}
                                </div>
                              ))}
                              {node.keys.length === 0 && (
                                <div className="px-3 py-2 text-zinc-600 italic text-sm">Empty</div>
                              )}
                            </div>
                            {node.isLeaf && (
                              <div className="flex flex-col items-center pb-2 bg-zinc-950/50">
                                <div className="w-px h-3 bg-zinc-700"></div>
                                <div className="px-2 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-zinc-500 font-mono text-[10px] shadow-inner">
                                  nullptr
                                </div>
                              </div>
                            )}
                            </div>
                            {/* Leaf Chain Arrow */}
                            {node.isLeaf && (
                              node.next ? (
                                <div className="mx-2 text-zinc-600 flex items-center shrink-0">
                                  <ArrowRight className="w-5 h-5" />
                                </div>
                              ) : (
                                <div className="flex items-center shrink-0">
                                  <div className="mx-2 text-zinc-600 flex items-center">
                                    <ArrowRight className="w-5 h-5" />
                                  </div>
                                  <div className="px-3 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-500 font-mono text-sm shadow-inner">
                                    nullptr
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
              </TransformComponent>
            </TransformWrapper>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Controls & Logs */}
      <div className="lg:col-span-1 xl:col-span-1 flex flex-col gap-4 overflow-hidden h-full">
        <Card className="bg-zinc-900 border-zinc-800 shrink-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-zinc-200 text-lg">Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input 
                placeholder="Key" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="bg-zinc-950 border-zinc-700 text-zinc-100"
              />
              <Input 
                placeholder="Value (Opt)" 
                value={inputValValue}
                onChange={(e) => setInputValValue(e.target.value)}
                className="bg-zinc-950 border-zinc-700 text-zinc-100"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button onClick={handleInsert} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="w-4 h-4 mr-1" /> Insert
              </Button>
              <Button onClick={handleRemove} variant="destructive">
                <Trash className="w-4 h-4 mr-1" /> Remove
              </Button>
              <Button onClick={handleSearch} variant="secondary">
                <Search className="w-4 h-4 mr-1" /> Search
              </Button>
            </div>

            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-400">Tree Order (Max Children: {order})</span>
              </div>
              <Slider 
                value={[order]} 
                min={3} 
                max={6} 
                step={1} 
                onValueChange={(v) => setOrder(Array.isArray(v) ? v[0] : v)}
                className="py-2"
                disabled={isAnimating}
              />
            </div>

            <div className="pt-2 border-t border-zinc-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-400">Animation Speed</span>
                <span className="text-xs text-indigo-400">{playbackSpeed}ms</span>
              </div>
              <Slider 
                value={[playbackSpeed]} 
                min={100} 
                max={5000} 
                step={100} 
                onValueChange={(v) => setPlaybackSpeed(Array.isArray(v) ? v[0] : v)}
                className="py-2"
              />
            </div>

            <div className="pt-2 grid grid-cols-2 gap-2">
              <Button onClick={() => setOrder(order)} variant="outline" className="w-full border-zinc-700 text-zinc-300" disabled={isAnimating}>
                <RotateCcw className="w-4 h-4 mr-2" /> Reset Demo
              </Button>
              <Button onClick={handleClear} variant="outline" className="w-full border-zinc-700 text-zinc-300">
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 flex-1 flex flex-col min-h-[300px]">
          <CardHeader className="pb-3 shrink-0">
            <CardTitle className="text-zinc-200 text-lg">Operation Log</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0 px-4 pb-4">
            <div className="h-full pr-4 overflow-y-auto custom-scrollbar">
              <div className="space-y-3 flex flex-col">
                {tree.logs.map((log: any) => (
                  <div key={log.id} className="text-sm bg-zinc-950 p-3 rounded border border-zinc-800 animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        log.type === 'insert' ? 'bg-green-500/20 text-green-400' :
                        log.type === 'remove' ? 'bg-red-500/20 text-red-400' :
                        log.type === 'search' ? 'bg-blue-500/20 text-blue-400' :
                        log.type === 'split' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-purple-500/20 text-purple-400'
                      }`}>
                        {log.type.toUpperCase()}
                      </span>
                      <span className="text-zinc-500 text-xs">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-zinc-300">{log.message}</p>
                  </div>
                ))}
                {tree.logs.length === 0 && (
                  <p className="text-zinc-500 text-center mt-4">No operations yet.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CodeViewer() {
  return (
    <Card className="bg-zinc-900 border-zinc-800 h-full flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="text-zinc-200 text-lg">C++ Source Reference</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="h-full overflow-y-auto custom-scrollbar">
          <pre className="p-4 text-sm font-mono text-zinc-300">
            <code>{cppSource}</code>
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

function Header() {
  const location = useLocation();
  const isCode = location.pathname === '/code';

  return (
    <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-400">
          Interactive B+ Tree Visualizer
        </h1>
        <p className="text-zinc-400 mt-1">Watch data structure operations in real-time</p>
      </div>
      <nav className="flex items-center gap-3">
        <Link to="/">
          <Button variant={isCode ? "outline" : "default"} className={!isCode ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "border-zinc-700 text-zinc-300"}>
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Visualizer
          </Button>
        </Link>
        <Link to="/code">
          <Button variant={isCode ? "default" : "outline"} className={isCode ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "border-zinc-700 text-zinc-300"}>
            <Code className="w-4 h-4 mr-2" />
            C++ Source
          </Button>
        </Link>
      </nav>
    </header>
  );
}

export default function App() {
  const [order, setOrder] = useState(3);
  const [tree, setTree] = useState(new BPlusTree(order));
  const [renderCounter, setRenderCounter] = useState(0);
  const triggerRender = () => setRenderCounter(c => c + 1);

  useEffect(() => {
    // Demo seed
    const newTree = new BPlusTree(order);
    const keys = [10, 20, 5, 6, 12, 30, 7, 17, 3, 25, 1, 8];
    keys.forEach(k => newTree.insert(k, k * 100));
    setTree(newTree);
    triggerRender();
  }, [order]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col p-4 font-sans h-screen">
        <Header />
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route 
              path="/" 
              element={<Visualizer tree={tree} order={order} setOrder={setOrder} setTree={setTree} triggerRender={triggerRender} renderCounter={renderCounter} />} 
            />
            <Route 
              path="/code" 
              element={<CodeViewer />} 
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
