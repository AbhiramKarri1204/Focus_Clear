/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import FocusCheckFix from "./components/FocusCheckFix";

export default function App() {
  return (
    <div className="min-h-screen bg-[#0D0D0D] text-[#E0E0E0] font-sans flex flex-col justify-between selection:bg-[#D4AF37]/30 selection:text-white">
      <main className="flex-grow flex items-center justify-center">
        <FocusCheckFix />
      </main>
      
      <footer className="py-6 border-t border-zinc-900 bg-[#0A0A0A] text-center text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
        &copy; {new Date().getFullYear()} Focus Clear &bull; Advanced AI Image Restoration
      </footer>
    </div>
  );
}
