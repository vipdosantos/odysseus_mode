import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink } from 'lucide-react';

export default function DeliveryMapPicker({ address, lat, lng, onChange }) {
  const [inputAddr, setInputAddr] = useState(address || '');

  const applyAddress = () => {
    onChange({ address: inputAddr, lat: null, lng: null });
  };

  const mapsUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;

  const embedUrl = address
    ? `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed&z=15`
    : null;

  return (
    <div className="space-y-2">
      <Label>Endereço de Entrega (Pin no Mapa)</Label>
      <div className="flex gap-2">
        <Input
          value={inputAddr}
          onChange={e => setInputAddr(e.target.value)}
          placeholder="Rua, número, cidade..."
          className="flex-1"
          onKeyDown={e => e.key === 'Enter' && applyAddress()}
        />
        <Button type="button" variant="outline" size="sm" onClick={applyAddress}>
          <MapPin className="w-4 h-4" />
        </Button>
      </div>
      {embedUrl && (
        <div className="relative rounded-xl overflow-hidden border border-border" style={{ height: 200 }}>
          <iframe
            title="Mapa de entrega"
            src={embedUrl}
            width="100%"
            height="200"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
          />
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2 right-2 bg-white rounded-lg p-1.5 shadow text-xs flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <ExternalLink className="w-3 h-3" /> Abrir
          </a>
        </div>
      )}
    </div>
  );
}