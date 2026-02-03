'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { resizeImage } from '@/lib/trial-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Loader2 } from 'lucide-react';

export default function StorePage() {
  const params = useParams();
  const router = useRouter();
  const storeId = params.store_id as string;

  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [storeName, setStoreName] = useState<string>('');

  const sessionCreatedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (sessionCreatedRef.current) return;
    sessionCreatedRef.current = true;

    async function initialize() {
      try {
        const { data: storeData } = await supabase
          .from('stores')
          .select('name')
          .eq('id', storeId)
          .maybeSingle();

        if (storeData?.name) {
          setStoreName(storeData.name);
        }

        const { data: { session } } = await supabase.auth.getSession();

        let userId: string | undefined;

        if (!session) {
          const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
          if (authError) {
            console.error('Auth error:', authError);
            return;
          }
          userId = authData.user?.id;
        } else {
          userId = session.user?.id;
        }

        if (!userId) {
          console.error('No user ID available');
          return;
        }

        userIdRef.current = userId;
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, [storeId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleStartTrial = async () => {
    if (!selectedFile || !userIdRef.current) return;

    setUploading(true);

    try {
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);

      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          store_id: storeId,
          owner_id: userIdRef.current,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .maybeSingle();

      if (sessionError || !sessionData) {
        console.error('Session creation error:', sessionError);
        return;
      }

      sessionIdRef.current = sessionData.id;

      const resizedBlob = await resizeImage(selectedFile);
      const storagePath = `${sessionData.id}/customer.png`;

      const { error: uploadError } = await supabase.storage
        .from('trial-images')
        .upload(storagePath, resizedBlob, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return;
      }

      const { error: updateError } = await supabase
        .from('sessions')
        .update({ customer_image_path: storagePath })
        .eq('id', sessionData.id);

      if (updateError) {
        console.error('Database update error:', updateError);
        return;
      }

      router.push(`/store/${storeId}/trial/${sessionData.id}`);
    } catch (error) {
      console.error('Upload process error:', error);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">
            {storeName || 'Virtual Try-On'}
          </h1>
          <p className="mt-2 text-gray-600">
            Take or upload your photo to see how items look on you
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          {!previewUrl ? (
            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-gray-400 transition-colors">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Camera className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-700 font-medium mb-1">
                  Take a photo or choose from gallery
                </p>
                <p className="text-sm text-gray-500">
                  Stand in a well-lit area for best results
                </p>
              </div>
              <Input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-gray-100">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-auto max-h-96 object-contain"
                />
              </div>
              <div className="flex gap-3">
                <label className="flex-1 cursor-pointer">
                  <Button variant="outline" className="w-full" asChild>
                    <span>Change photo</span>
                  </Button>
                  <Input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <Button
                  onClick={handleStartTrial}
                  disabled={uploading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    'Start trial'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
