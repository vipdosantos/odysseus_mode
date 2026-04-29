import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';

export default function QRZoomModal({ open, onClose, qrUrl, label }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm flex flex-col items-center gap-4 p-8">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="font-semibold text-base text-center">{label}</p>
        <img src={qrUrl} alt="QR Code ampliado" className="w-72 h-72 rounded-xl border-2 border-border bg-white p-2" />
        <p className="text-xs text-muted-foreground text-center break-all">{label}</p>
      </DialogContent>
    </Dialog>
  );
}