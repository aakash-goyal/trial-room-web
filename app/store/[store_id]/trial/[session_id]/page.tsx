'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { InventoryItem, OverlayState, getCategoryLabel } from '@/lib/trial-utils';
import { Button } from '@/components/ui/button';
import { RotateCcw, Loader2, ThumbsUp } from 'lucide-react';

export default function TrialPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = params.store_id as string;
  const sessionId = params.session_id as string;

  const [loading, setLoading] = useState(true);
  const [customerImagePath, setCustomerImagePath] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedGarment, setSelectedGarment] = useState<InventoryItem | null>(null);
  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const [loadingGarment, setLoadingGarment] = useState(false);
  const [savingFinal, setSavingFinal] = useState(false);
  const [showCanvasHint, setShowCanvasHint] = useState(true);

  const customerImageRef = useRef<HTMLImageElement | null>(null);
  const garmentImageRef = useRef<HTMLImageElement | null>(null);
  const overlayRef = useRef<OverlayState | null>(null);
  const isFirstGarmentRef = useRef(true);

  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1);
  const animationFrameRef = useRef<number | null>(null);

  const categories = useMemo(() => {
    const uniqueCategories = new Set(inventory.map((item) => item.category).filter(Boolean));
    return Array.from(uniqueCategories) as string[];
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    if (!selectedCategory) return inventory;
    return inventory.filter((item) => item.category === selectedCategory);
  }, [inventory, selectedCategory]);

  const handleCategoryChange = useCallback((category: string) => {
    if (category === selectedCategory) return;
    setSelectedCategory(category);
    setSelectedGarment(null);
    garmentImageRef.current = null;
    overlayRef.current = null;
    setOverlay(null);
    isFirstGarmentRef.current = true;
    requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      const customerImg = customerImageRef.current;
      if (canvas && customerImg) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(customerImg, 0, 0);
        }
      }
    });
  }, [selectedCategory]);

  useEffect(() => {
    async function initialize() {
      try {
        const { data: sessionData, error: sessionError } = await supabase
          .from('sessions')
          .select('customer_image_path, final_snapshot_path')
          .eq('id', sessionId)
          .maybeSingle();

        if (sessionError || !sessionData) {
          console.error('Session fetch error:', sessionError);
          router.push(`/store/${storeId}`);
          return;
        }

        if (sessionData.final_snapshot_path) {
          router.push(`/store/${storeId}/done/${sessionId}`);
          return;
        }

        if (!sessionData.customer_image_path) {
          router.push(`/store/${storeId}`);
          return;
        }

        setCustomerImagePath(sessionData.customer_image_path);

        const { data: inventoryData, error: inventoryError } = await supabase
          .from('inventory')
          .select('*')
          .eq('store_id', storeId);

        if (inventoryError) {
          console.error('Inventory fetch error:', inventoryError);
          return;
        }

        const items = inventoryData || [];
        setInventory(items);

        const uniqueCategories = Array.from(new Set(items.map((item) => item.category).filter(Boolean))) as string[];
        if (uniqueCategories.length > 0) {
          setSelectedCategory(uniqueCategories[0]);
        }
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, [storeId, sessionId, router]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const customerImg = customerImageRef.current;
    if (!canvas || !customerImg) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(customerImg, 0, 0);

    const garmentImg = garmentImageRef.current;
    const currentOverlay = overlayRef.current;
    if (garmentImg && currentOverlay) {
      const scaledWidth = garmentImg.width * currentOverlay.scale;
      const scaledHeight = garmentImg.height * currentOverlay.scale;
      ctx.drawImage(
        garmentImg,
        currentOverlay.x,
        currentOverlay.y,
        scaledWidth,
        scaledHeight
      );
    }
  }, []);

  const loadAndDrawImage = useCallback(async (imagePath: string) => {
    const { data, error } = await supabase.storage
      .from('trial-images')
      .download(imagePath);

    if (error) {
      console.error('Image download error:', error);
      return;
    }

    const url = URL.createObjectURL(data);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = img.width;
      canvas.height = img.height;
      customerImageRef.current = img;

      renderCanvas();
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      console.error('Failed to load image');
    };

    img.src = url;
  }, [renderCanvas]);

  useEffect(() => {
    if (customerImagePath) {
      loadAndDrawImage(customerImagePath);
    }
  }, [customerImagePath, loadAndDrawImage]);

  const loadGarmentImage = useCallback(async (item: InventoryItem) => {
    setLoadingGarment(true);
    const imagePath = item.image_url;

    if (!imagePath) {
      setLoadingGarment(false);
      return;
    }

    const { data, error } = await supabase.storage
      .from('inventory-images')
      .download(imagePath);

    if (error) {
      console.error('Garment image download error:', error);
      setLoadingGarment(false);
      return;
    }

    const url = URL.createObjectURL(data);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      garmentImageRef.current = img;

      const canvas = canvasRef.current;
      if (!canvas) {
        setLoadingGarment(false);
        return;
      }

      const scaleFactor = item.scale_factor ?? 1.0;

      if (isFirstGarmentRef.current) {
        const scaledWidth = img.width * scaleFactor;
        const scaledHeight = img.height * scaleFactor;
        const centerX = (canvas.width - scaledWidth) / 2;
        const centerY = (canvas.height - scaledHeight) / 2;

        const newOverlay: OverlayState = {
          x: centerX,
          y: centerY,
          scale: scaleFactor,
        };
        overlayRef.current = newOverlay;
        setOverlay(newOverlay);
        isFirstGarmentRef.current = false;
      }

      renderCanvas();
      setLoadingGarment(false);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      console.error('Failed to load garment image');
      setLoadingGarment(false);
    };

    img.src = url;
  }, [renderCanvas]);

  const handleGarmentSelect = useCallback((item: InventoryItem) => {
    setSelectedGarment(item);
    loadGarmentImage(item);
  }, [loadGarmentImage]);

  const handleReset = useCallback(() => {
    if (!selectedGarment || !garmentImageRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const garmentImg = garmentImageRef.current;
    const scaleFactor = selectedGarment.scale_factor ?? 1.0;

    const scaledWidth = garmentImg.width * scaleFactor;
    const scaledHeight = garmentImg.height * scaleFactor;
    const centerX = (canvas.width - scaledWidth) / 2;
    const centerY = (canvas.height - scaledHeight) / 2;

    const newOverlay: OverlayState = {
      x: centerX,
      y: centerY,
      scale: scaleFactor,
    };
    overlayRef.current = newOverlay;
    setOverlay(newOverlay);
    renderCanvas();
  }, [selectedGarment, renderCanvas]);

  const getCanvasCoordinates = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const scheduleRender = useCallback(() => {
    if (animationFrameRef.current) return;
    animationFrameRef.current = requestAnimationFrame(() => {
      renderCanvas();
      animationFrameRef.current = null;
    });
  }, [renderCanvas]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!overlayRef.current) return;

    setShowCanvasHint(false);
    isDraggingRef.current = true;
    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    lastPointerRef.current = coords;

    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }, [getCanvasCoordinates]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || !overlayRef.current || !lastPointerRef.current) return;

    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    const deltaX = coords.x - lastPointerRef.current.x;
    const deltaY = coords.y - lastPointerRef.current.y;

    overlayRef.current.x += deltaX;
    overlayRef.current.y += deltaY;
    lastPointerRef.current = coords;

    scheduleRender();
  }, [getCanvasCoordinates, scheduleRender]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    lastPointerRef.current = null;

    (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);

    if (overlayRef.current) {
      setOverlay({ ...overlayRef.current });
    }
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!overlayRef.current || !garmentImageRef.current) return;
    e.preventDefault();
    setShowCanvasHint(false);

    const scaleDelta = e.deltaY > 0 ? 0.95 : 1.05;
    const newScale = Math.max(0.1, Math.min(5, overlayRef.current.scale * scaleDelta));

    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    const garmentImg = garmentImageRef.current;

    const oldWidth = garmentImg.width * overlayRef.current.scale;
    const oldHeight = garmentImg.height * overlayRef.current.scale;
    const newWidth = garmentImg.width * newScale;
    const newHeight = garmentImg.height * newScale;

    const relX = (coords.x - overlayRef.current.x) / oldWidth;
    const relY = (coords.y - overlayRef.current.y) / oldHeight;

    overlayRef.current.x = coords.x - relX * newWidth;
    overlayRef.current.y = coords.y - relY * newHeight;
    overlayRef.current.scale = newScale;

    scheduleRender();
  }, [getCanvasCoordinates, scheduleRender]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    setShowCanvasHint(false);
    if (e.touches.length === 2 && overlayRef.current) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      initialPinchDistanceRef.current = distance;
      initialScaleRef.current = overlayRef.current.scale;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2 && overlayRef.current && initialPinchDistanceRef.current !== null) {
      e.preventDefault();

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      const scaleRatio = distance / initialPinchDistanceRef.current;
      const newScale = Math.max(0.1, Math.min(5, initialScaleRef.current * scaleRatio));

      const midX = (touch1.clientX + touch2.clientX) / 2;
      const midY = (touch1.clientY + touch2.clientY) / 2;
      const coords = getCanvasCoordinates(midX, midY);

      const garmentImg = garmentImageRef.current;
      if (garmentImg) {
        const oldWidth = garmentImg.width * overlayRef.current.scale;
        const oldHeight = garmentImg.height * overlayRef.current.scale;
        const newWidth = garmentImg.width * newScale;
        const newHeight = garmentImg.height * newScale;

        const relX = (coords.x - overlayRef.current.x) / oldWidth;
        const relY = (coords.y - overlayRef.current.y) / oldHeight;

        overlayRef.current.x = coords.x - relX * newWidth;
        overlayRef.current.y = coords.y - relY * newHeight;
      }

      overlayRef.current.scale = newScale;
      scheduleRender();
    }
  }, [getCanvasCoordinates, scheduleRender]);

  const handleTouchEnd = useCallback(() => {
    initialPinchDistanceRef.current = null;
    if (overlayRef.current) {
      setOverlay({ ...overlayRef.current });
    }
  }, []);

  const handleSaveFinal = useCallback(async () => {
    if (!sessionId || !customerImageRef.current || !garmentImageRef.current || !overlayRef.current) return;

    setSavingFinal(true);

    try {
      const customerImg = customerImageRef.current;
      const garmentImg = garmentImageRef.current;
      const currentOverlay = overlayRef.current;

      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = customerImg.width;
      offscreenCanvas.height = customerImg.height;
      const ctx = offscreenCanvas.getContext('2d');

      if (!ctx) {
        console.error('Failed to get offscreen canvas context');
        return;
      }

      ctx.drawImage(customerImg, 0, 0);

      const scaledWidth = garmentImg.width * currentOverlay.scale;
      const scaledHeight = garmentImg.height * currentOverlay.scale;
      ctx.drawImage(
        garmentImg,
        currentOverlay.x,
        currentOverlay.y,
        scaledWidth,
        scaledHeight
      );

      const blob = await new Promise<Blob | null>((resolve) => {
        offscreenCanvas.toBlob(resolve, 'image/png');
      });

      if (!blob) {
        console.error('Failed to create final image blob');
        return;
      }

      const storagePath = `${sessionId}/final.png`;

      const { error: uploadError } = await supabase.storage
        .from('trial-images')
        .upload(storagePath, blob, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        console.error('Final image upload error:', uploadError);
        return;
      }

      const { error: updateError } = await supabase
        .from('sessions')
        .update({ final_snapshot_path: storagePath })
        .eq('id', sessionId);

      if (updateError) {
        console.error('DB update error:', updateError);
        return;
      }

      router.push(`/store/${storeId}/done/${sessionId}`);
    } catch (error) {
      console.error('Save final error:', error);
    } finally {
      setSavingFinal(false);
    }
  }, [sessionId, storeId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex flex-col lg:flex-row h-screen">
        <div className="flex-1 flex flex-col p-4 lg:p-6">
          <div className="flex-1 flex items-center justify-center relative">
            <div className="relative inline-block max-w-full max-h-full">
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-[70vh] lg:max-h-[80vh] border border-gray-200 rounded-lg touch-none bg-white shadow-sm"
                style={{ objectFit: 'contain' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />
              {loadingGarment && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                  <div className="bg-white/90 backdrop-blur-sm rounded-full p-3">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
                  </div>
                </div>
              )}
              {showCanvasHint && overlay && !loadingGarment && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
                  <div className="bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full whitespace-nowrap">
                    Drag to move · Pinch / scroll to resize
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center gap-3 py-4">
            {selectedGarment && !loadingGarment && (
              <Button
                variant="outline"
                onClick={handleReset}
                className="bg-white"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            )}
            {selectedGarment && overlay && (
              <Button
                onClick={handleSaveFinal}
                disabled={savingFinal}
                className="bg-green-600 hover:bg-green-700 text-white px-6"
              >
                {savingFinal ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    Looks good
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {inventory.length > 0 && (
          <div className="w-full lg:w-72 bg-white border-t lg:border-t-0 lg:border-l border-gray-200 p-4 lg:p-6 overflow-auto">
            {categories.length > 1 && (
              <div className="mb-4">
                <div className="flex rounded-lg bg-gray-100 p-1">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => handleCategoryChange(category)}
                      className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                        selectedCategory === category
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {getCategoryLabel(category)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <h3 className="text-sm font-medium text-gray-700 mb-4">Select Item</h3>
            <div className="grid grid-cols-3 lg:grid-cols-2 gap-3">
              {filteredInventory.map((item) => (
                <GarmentThumbnail
                  key={item.id}
                  item={item}
                  isSelected={selectedGarment?.id === item.id}
                  onSelect={handleGarmentSelect}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GarmentThumbnail({
  item,
  isSelected,
  onSelect,
}: {
  item: InventoryItem;
  isSelected: boolean;
  onSelect: (item: InventoryItem) => void;
}) {
  const imagePath = item.image_url;
  const { data } = supabase.storage
    .from('inventory-images')
    .getPublicUrl(imagePath || '');

  return (
    <button
      onClick={() => onSelect(item)}
      className={`aspect-square rounded-lg border-2 overflow-hidden transition-all ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <img
        src={data.publicUrl}
        alt={item.name}
        className="w-full h-full object-cover bg-gray-100"
        loading="lazy"
      />
    </button>
  );
}
