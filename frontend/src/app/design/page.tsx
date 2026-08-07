"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Stage, Layer, Rect, Text as KonvaText, Image as KonvaImage, Transformer } from "react-konva";
import useImage from "use-image";
import { v4 as uuidv4 } from "uuid";
import { api } from "@/lib/api";
import { Zone, Template, getDefaultGridZones } from "@/types";
import Link from "next/link";

interface EditorZone extends Zone {
  id: string;
}

function assignLogicalGrid(zones: EditorZone[]): EditorZone[] {
  if (zones.length !== 27) return zones;
  
  // Sort by center Y to find the 3 rows
  const sortedByY = [...zones].sort((a, b) => (a.y + a.height / 2) - (b.y + b.height / 2));
  
  const rows = [
    sortedByY.slice(0, 9).sort((a, b) => (a.x + a.width / 2) - (b.x + b.width / 2)),
    sortedByY.slice(9, 18).sort((a, b) => (a.x + a.width / 2) - (b.x + b.width / 2)),
    sortedByY.slice(18, 27).sort((a, b) => (a.x + a.width / 2) - (b.x + b.width / 2))
  ];

  const assigned: EditorZone[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 9; c++) {
      assigned.push({ ...rows[r][c], row_index: r, column_index: c });
    }
  }
  return assigned;
}

export default function DesignStudio() {
  const router = useRouter();

  // State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [bgImageObj] = useImage(bgPreview || "");

  const [zones, setZones] = useState<EditorZone[]>(() => {
    return getDefaultGridZones(800, 400).map((z) => ({ ...z, id: uuidv4() }));
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [savedTemplates, setSavedTemplates] = useState<Template[]>([]);
  const [loadedTemplateId, setLoadedTemplateId] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [pendingTemplateZones, setPendingTemplateZones] = useState<Zone[] | null>(null);

  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  // Default Canvas Size based on common Tambola tickets
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 400;
  
  // To keep background proportional
  const scaleX = bgImageObj ? CANVAS_WIDTH / bgImageObj.width : 1;
  const scaleY = bgImageObj ? CANVAS_HEIGHT / bgImageObj.height : 1;
  const bgScale = Math.min(scaleX, scaleY);

  const imgW = bgImageObj ? bgImageObj.width * bgScale : CANVAS_WIDTH;
  const imgH = bgImageObj ? bgImageObj.height * bgScale : CANVAS_HEIGHT;
  const imgX = bgImageObj ? (CANVAS_WIDTH - imgW) / 2 : 0;
  const imgY = bgImageObj ? (CANVAS_HEIGHT - imgH) / 2 : 0;

  useEffect(() => {
    if (bgImageObj && pendingTemplateZones) {
      const editorZones = pendingTemplateZones.map((z) => ({
        ...z,
        id: uuidv4(),
        x: imgX + (z.x / 100) * imgW,
        y: imgY + (z.y / 100) * imgH,
        width: (z.width / 100) * imgW,
        height: (z.height / 100) * imgH,
      }));
      setZones(editorZones);
      setPendingTemplateZones(null);
    }
  }, [bgImageObj, pendingTemplateZones, imgX, imgY, imgW, imgH]);

  useEffect(() => {
    const loggedIn = api.isLoggedIn();
    setIsLoggedIn(loggedIn);
    if (loggedIn) {
      api.getTemplates().then((res) => setSavedTemplates(res.templates)).catch(console.error);
    }
  }, []);

  useEffect(() => {
    if (selectedId && trRef.current && layerRef.current) {
      const node = layerRef.current.findOne(`#${selectedId}`);
      if (node) {
        trRef.current.nodes([node]);
        trRef.current.getLayer().batchDraw();
      }
    }
  }, [selectedId, zones]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with form inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Delete / Backspace
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        setZones((prev) => prev.filter((z) => z.id !== selectedId));
        setSelectedId(null);
      }
      
      // Copy (Ctrl+C / Cmd+C)
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && selectedId) {
        const zoneToCopy = zones.find((z) => z.id === selectedId);
        if (zoneToCopy) {
          localStorage.setItem("tambola_copied_zone", JSON.stringify(zoneToCopy));
        }
      }
      
      // Paste (Ctrl+V / Cmd+V)
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        const copied = localStorage.getItem("tambola_copied_zone");
        if (copied) {
          try {
            const parsed = JSON.parse(copied) as EditorZone;
            const newZone = {
              ...parsed,
              id: uuidv4(),
              x: parsed.x + 20, // Offset paste
              y: parsed.y + 20,
            };
            // Auto-detect column based on new X
            const centerX = newZone.x + newZone.width / 2;
            const centerY = newZone.y + newZone.height / 2;
            newZone.column_index = Math.min(8, Math.max(0, Math.floor(centerX / (CANVAS_WIDTH / 9))));
            newZone.row_index = Math.min(2, Math.max(0, Math.floor(centerY / (CANVAS_HEIGHT / 3))));
            setZones((prev) => [...prev, newZone]);
            setSelectedId(newZone.id);
          } catch (err) {}
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, zones, CANVAS_WIDTH]);

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBgFile(file);
      setBgPreview(URL.createObjectURL(file));
      setLoadedTemplateId(null);
    }
  };

  const handleSaveTemplate = async () => {
    if (!bgFile) {
      setError("Cannot save without a background image.");
      return;
    }
    if (!templateName.trim()) {
      setError("Please enter a name for your template.");
      return;
    }

    setSavingTemplate(true);
    setError(null);
    try {
      const gridAssignedZones = assignLogicalGrid(zones);
      const normalizedZones: Zone[] = gridAssignedZones.map((z) => ({
        x: Math.max(0, Math.min(100, ((z.x - imgX) / imgW) * 100)),
        y: Math.max(0, Math.min(100, ((z.y - imgY) / imgH) * 100)),
        width: Math.max(0.5, Math.min(100, (z.width / imgW) * 100)),
        height: Math.max(0.5, Math.min(100, (z.height / imgH) * 100)),
        row_index: z.row_index,
        column_index: z.column_index,
        font: z.font,
        font_size: z.font_size,
        color: z.color,
        align: z.align,
      }));

      const res = await api.saveTemplate(templateName.trim(), bgFile, normalizedZones);
      setSavedTemplates([res.template, ...savedTemplates]);
      setLoadedTemplateId(res.template.id);
      setTemplateName("");
      alert("Template saved successfully!");
    } catch (err: any) {
      alert("Failed to save template: " + err.message);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleLoadTemplate = (template: Template) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    setBgPreview(`${API_URL}${template.backgroundImageUrl}`);
    // Create a dummy file to satisfy the validation requirement if we need to fall back
    setBgFile(new File([], "placeholder.jpg")); 
    
    setPendingTemplateZones(template.zones);
    setLoadedTemplateId(template.id);
  };

  const handleGenerate = async () => {
    if (!bgFile) {
      setError("Please upload a background image.");
      return;
    }
    if (zones.length !== 27) {
      setError(`You must have exactly 27 zones (currently have ${zones.length}).`);
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      // Normalize zones to percentages (0-100) based on canvas size and clamp to valid bounds
      const gridAssignedZones = assignLogicalGrid(zones);
      const normalizedZones: Zone[] = gridAssignedZones.map((z) => ({
        x: Math.max(0, Math.min(100, ((z.x - imgX) / imgW) * 100)),
        y: Math.max(0, Math.min(100, ((z.y - imgY) / imgH) * 100)),
        width: Math.max(0.5, Math.min(100, (z.width / imgW) * 100)),
        height: Math.max(0.5, Math.min(100, (z.height / imgH) * 100)),
        row_index: z.row_index,
        column_index: z.column_index,
        font: z.font,
        font_size: z.font_size,
        color: z.color,
        align: z.align,
      }));

      const requestData: Parameters<typeof api.createBatch>[0] = {
        quantity,
      };

      if (loadedTemplateId) {
        requestData.template_id = loadedTemplateId;
      } else {
        requestData.background = bgFile;
        requestData.zones = normalizedZones;
      }

      const res = await api.createBatch(requestData);

      router.push(`/batch/${res.job_id}`);
    } catch (err: any) {
      setError(err.message);
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <nav className="border-b border-gray-800 bg-gray-900 px-4 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl hover:opacity-80 transition-opacity">🎰</Link>
          <h1 className="font-semibold text-gray-200">Design Studio</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {!isLoggedIn && <span className="text-amber-400 bg-amber-400/10 px-2 py-1 rounded">Guest Mode</span>}
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 border-r border-gray-800 bg-gray-900 p-6 flex flex-col gap-6 overflow-y-auto">
          
          {isLoggedIn && savedTemplates.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">My Saved Designs</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {savedTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleLoadTemplate(t)}
                    className={`w-full text-left px-3 py-2 text-sm rounded border ${loadedTemplateId === t.id ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'}`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">1. Background Image</h3>
            <label className="block w-full cursor-pointer">
              <div className="w-full h-32 border-2 border-dashed border-gray-700 hover:border-indigo-500 rounded-xl flex items-center justify-center bg-gray-800/50 transition-colors overflow-hidden">
                {bgPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bgPreview} alt="Preview" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-sm text-gray-500">Click to upload (JPG/PNG)</span>
                )}
              </div>
              <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleBgUpload} />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">2. Number Zones</h3>
              <span className={`text-xs font-mono px-2 py-0.5 rounded ${zones.length === 27 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {zones.length}/27
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Drag to position. Select to resize. Each cell corresponds to a specific row and column on a standard 3x9 Tambola ticket. 
            </p>
            <button 
              onClick={() => setZones(getDefaultGridZones(CANVAS_WIDTH, CANVAS_HEIGHT).map(z => ({...z, id: uuidv4()})))}
              className="w-full py-2 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700"
            >
              Reset to Standard Grid
            </button>
          </div>

          <div className="mt-auto">
            <h3 className="text-sm font-medium text-gray-400 mb-2">3. Generate Batch</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Quantity (Tickets)</label>
                <input 
                  type="number" 
                  min="10" 
                  max="10000" 
                  value={quantity} 
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 10)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              
              {error && <div className="text-xs text-red-400 bg-red-400/10 p-2 rounded">{error}</div>}
              
              <button
                onClick={handleGenerate}
                disabled={generating || !bgFile || zones.length !== 27}
                className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? "Initializing..." : "Generate Tickets"}
              </button>
              
              {isLoggedIn && !loadedTemplateId && bgFile && (
                <div className="pt-2 border-t border-gray-800 space-y-2 mt-4">
                  <input
                    type="text"
                    placeholder="Template Name"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate || zones.length !== 27 || !templateName.trim()}
                    className="w-full py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingTemplate ? "Saving..." : "Save as Template"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-gray-950 flex items-center justify-center p-8 overflow-auto relative">
          <div 
            className="shadow-2xl shadow-black/50 ring-1 ring-white/10 relative" 
            style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundColor: 'white' }}
          >
            <Stage
              ref={stageRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onMouseDown={(e) => {
                if (e.target === e.target.getStage() || e.target.hasName('bg')) {
                  setSelectedId(null);
                }
              }}
            >
              <Layer ref={layerRef}>
                {bgImageObj && (
                  <KonvaImage
                    image={bgImageObj}
                    width={bgImageObj.width * bgScale}
                    height={bgImageObj.height * bgScale}
                    x={(CANVAS_WIDTH - bgImageObj.width * bgScale) / 2}
                    y={(CANVAS_HEIGHT - bgImageObj.height * bgScale) / 2}
                    name="bg"
                  />
                )}
                
                {/* Grid Overlay for reference (optional, could toggle) */}
                {Array.from({length: 8}).map((_, i) => (
                  <Rect key={`vline-${i}`} x={(i+1)*(CANVAS_WIDTH/9)} y={0} width={1} height={CANVAS_HEIGHT} fill="rgba(0,0,0,0.05)" listening={false} />
                ))}
                {Array.from({length: 2}).map((_, i) => (
                  <Rect key={`hline-${i}`} x={0} y={(i+1)*(CANVAS_HEIGHT/3)} width={CANVAS_WIDTH} height={1} fill="rgba(0,0,0,0.05)" listening={false} />
                ))}

                {(() => {
                  const displayZones = assignLogicalGrid(zones);
                  return displayZones.map((zone) => {
                    const isSelected = zone.id === selectedId;
                    const displayNum = zone.column_index === 0 ? 5 : zone.column_index * 10 + 5;

                    return (
                      <React.Fragment key={zone.id}>
                        <Rect
                        id={zone.id}
                        x={zone.x}
                        y={zone.y}
                        width={zone.width}
                        height={zone.height}
                        fill="rgba(99, 102, 241, 0.1)"
                        stroke={isSelected ? "#4f46e5" : "rgba(99, 102, 241, 0.4)"}
                        strokeWidth={2}
                        draggable
                        onClick={() => setSelectedId(zone.id)}
                        onTap={() => setSelectedId(zone.id)}
                        onDragEnd={(e) => {
                          const nodes = [...zones];
                          const idx = nodes.findIndex((n) => n.id === zone.id);
                          if (idx >= 0) {
                            nodes[idx].x = e.target.x();
                            nodes[idx].y = e.target.y();
                            setZones(nodes);
                            setLoadedTemplateId(null); // Modifying means it's no longer the saved template
                          }
                        }}
                        onTransformEnd={(e) => {
                          const node = e.target;
                          const scaleX = node.scaleX();
                          const scaleY = node.scaleY();
                          
                          node.scaleX(1);
                          node.scaleY(1);

                          const nodes = [...zones];
                          const idx = nodes.findIndex((n) => n.id === zone.id);
                          if (idx >= 0) {
                            nodes[idx].x = node.x();
                            nodes[idx].y = node.y();
                            nodes[idx].width = Math.max(5, node.width() * scaleX);
                            nodes[idx].height = Math.max(5, node.height() * scaleY);
                            setZones(nodes);
                            setLoadedTemplateId(null);
                          }
                        }}
                      />
                      {/* Fake Number for visual reference */}
                      <KonvaText
                        x={zone.x}
                        y={zone.y + (zone.height / 2) - (Math.min(zone.font_size, zone.height * 0.8) / 2)}
                        width={zone.width}
                        text={displayNum.toString()}
                        fontSize={Math.min(zone.font_size, zone.height * 0.8)}
                        fontFamily={zone.font}
                        fill={zone.color}
                        align={zone.align}
                        listening={false}
                      />
                      </React.Fragment>
                    );
                  });
                })()}

                <Transformer
                  ref={trRef}
                  boundBoxFunc={(oldBox, newBox) => {
                    if (newBox.width < 10 || newBox.height < 10) return oldBox;
                    return newBox;
                  }}
                  padding={5}
                />
              </Layer>
            </Stage>
          </div>
          
          {/* Instructions Overlay if empty */}
          {!bgFile && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-gray-900/80 backdrop-blur px-6 py-4 rounded-xl border border-gray-700 text-center shadow-xl">
                <span className="text-3xl mb-2 block">🖼️</span>
                <p className="text-gray-300 font-medium">Upload a background image to start</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
