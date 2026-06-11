/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import { SheetData } from './types';

export default function App() {
  const [sheets, setSheets] = useState<SheetData[] | null>(null);

  const handleDataLoaded = (loadedSheets: SheetData[]) => {
    setSheets(loadedSheets);
  };

  const handleReset = () => {
    setSheets(null);
  };

  return (
    <>
      {sheets ? (
        <Dashboard sheets={sheets} onReset={handleReset} />
      ) : (
        <FileUpload onDataLoaded={handleDataLoaded} />
      )}
    </>
  );
}
