'use client';

import { useState } from 'react';
import { validateAndNormalizeUrl } from '@radarjob/shared';
import { LinkAnatomy } from './link-anatomy';
import { UrlAnalyzerForm } from './url-analyzer-form';

export function HeroAnalyzer() {
  const [url, setUrl] = useState('');
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-start [&>*]:min-w-0">
      <UrlAnalyzerForm onUrlChange={setUrl} />
      <LinkAnatomy value={validateAndNormalizeUrl(url).ok ? url : ''} />
    </div>
  );
}
