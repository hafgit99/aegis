
import React from 'react';

const SkeletonCard: React.FC = () => {
  return (
    <div className="glass rounded-[2.5rem] border border-white/5 p-6 animate-pulse">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-zinc-800" />
        <div className="flex-1 space-y-2">
          <div className="h-2 w-16 bg-zinc-800 rounded" />
          <div className="h-4 w-32 bg-zinc-800 rounded" />
          <div className="h-2 w-24 bg-zinc-800 rounded" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-14 w-full bg-zinc-800/40 rounded-[1.5rem]" />
      </div>
      <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
        <div className="flex gap-2">
          <div className="w-8 h-8 bg-zinc-800 rounded-lg" />
          <div className="w-8 h-8 bg-zinc-800 rounded-lg" />
          <div className="w-8 h-8 bg-zinc-800 rounded-lg" />
        </div>
        <div className="w-8 h-8 bg-zinc-800 rounded-lg" />
      </div>
    </div>
  );
};

export default SkeletonCard;
