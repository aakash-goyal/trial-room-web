'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase, supabaseInitError } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Loader2, Check, RefreshCw } from 'lucide-react';

export default function DonePage() {
  const params = useParams();
  const router = useRouter();
  const storeId = params.store_id as string;
  const sessionId = params.session_id as string;

  const [loading, setLoading] = useState(true);
  const [finalImageUrl, setFinalImageUrl] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(supabaseInitError);

  useEffect(() => {
    async function loadFinalImage() {
      if (!supabase) {
        setInitError(supabaseInitError ?? 'Supabase client is not configured.');
        setLoading(false);
        return;
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase
          .from('sessions')
          .select('final_snapshot_path')
          .eq('id', sessionId)
          .maybeSingle();

        if (sessionError || !sessionData?.final_snapshot_path) {
          console.error('Session fetch error:', sessionError);
          router.push(`/store/${storeId}`);
          return;
        }

        const { data: imageData, error: downloadError } = await supabase.storage
          .from('trial-images')
          .download(sessionData.final_snapshot_path);

        if (downloadError || !imageData) {
          console.error('Image download error:', downloadError);
          return;
        }

        const url = URL.createObjectURL(imageData);
        setFinalImageUrl(url);
      } catch (error) {
        console.error('Load error:', error);
      } finally {
        setLoading(false);
      }
    }

    loadFinalImage();

    return () => {
      if (finalImageUrl) {
        URL.revokeObjectURL(finalImageUrl);
      }
    };
  }, [sessionId, storeId, router]);

  const handleStartNew = () => {
    router.push(`/store/${storeId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold text-gray-900">Store unavailable</h1>
          <p className="text-gray-600">
            {initError} Configure the Supabase environment variables in Vercel to enable
            the demo store.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8 lg:py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-green-50 border-b border-green-100 p-6 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-green-600" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">
              Your look is saved
            </h1>
            <p className="mt-1 text-gray-600">
              Here is your final try-on result
            </p>
          </div>

          {finalImageUrl && (
            <div className="p-4 lg:p-6">
              <div className="rounded-xl overflow-hidden bg-gray-100">
                <img
                  src={finalImageUrl}
                  alt="Final look"
                  className="w-full h-auto"
                />
              </div>
            </div>
          )}

          <div className="p-4 lg:p-6 pt-0">
            <Button
              variant="outline"
              onClick={handleStartNew}
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Start new trial
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
