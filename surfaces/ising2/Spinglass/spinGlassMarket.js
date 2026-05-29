// ⇒ a React component that listens to 'magnetizationUpdate'
//    and uses  1 − |mVal|  as its glitchIntensity.

import React, { useState, useEffect, useRef } from 'https://cdn.skypack.dev/react';
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'https://cdn.skypack.dev/recharts';
import {
  TrendingUp, TrendingDown, Zap, Hexagon,
  RefreshCw, GitBranch, Code
} from 'https://cdn.skypack.dev/lucide-react';

export default function SpinGlassMarket() {
  const [marketData, setMarketData] = useState([]);
  const [memeStocks, setMemeStocks] = useState([]);
  const [glitchIntensity, setGlitchIntensity] = useState(0.5);
  const timeoutRef = useRef();

  // initialize memes + data
  useEffect(()=>{
    setMemeStocks([
      { id:'DADA', name:'Digital Dadaism',  price:420.69, change:4.20, volume:80984,  color:'#ff2a6d' },
      /* …rest of your array… */
      { id:'LORE', name:'Digital Folklore', price:42.00, change:-0.42, volume:101010, color:'#fffc00' },
    ]);
    setMarketData(generateData(50));
    // start loop
    timeoutRef.current = setTimeout(simulate, 1000);
    return ()=> clearTimeout(timeoutRef.current);
  }, []);

  // listen to Ising → magnetization
  useEffect(()=>{
    const handler = e => {
      const m = e.detail.smoothedMag;
      // high disorder (m≈0) → high glitch
      setGlitchIntensity(1 - Math.abs(m));
    };
    window.addEventListener('magnetizationUpdate', handler);
    return ()=> window.removeEventListener('magnetizationUpdate', handler);
  }, []);

  function generateData(n) {
    let val = 300 + Math.random()*100;
    return Array.from({length:n},(_,i)=>{
      const move = (Math.random()-0.5)*0.03*val;
      val = Math.max(0,val+move);
      return { time:i, open:val, close:val*(1+(Math.random()-0.5)*0.02),
               high:val*1.01, low:val*0.99, volume:Math.random()*1e4|0 };
    });
  }

  function simulate(){
    setMarketData(prev=>{
      const last = prev[prev.length-1]||{ close:300, time:0 };
      const vol = 0.04*(1+glitchIntensity);
      const mv  = (Math.random()-0.5)*vol*last.close;
      const close = Math.max(0, last.close+mv);
      const newEntry = {
        time: last.time+1,
        open: last.close, close,
        high: Math.max(last.close,close)*1.01*(1+glitchIntensity*0.1),
        low:  Math.min(last.close,close)*0.99,
        volume: Math.random()*1e4*(1+glitchIntensity)|0
      };
      return [...prev.slice(1), newEntry];
    });
    setMemeStocks(ms=> ms.map(s=>{
      const d = s.change + (Math.random()-0.5)*2*glitchIntensity;
      return {
        ...s,
        change: +d.toFixed(2),
        price: +(s.price*(1 + d/100*0.1)).toFixed(2),
        volume: Math.floor(s.volume*(0.95 + Math.random()*0.1))
      };
    }));
    timeoutRef.current = setTimeout(simulate, 1000);
  }

  const getCandleColor = e => e.close > e.open
    ? 'rgba(0,255,159,0.8)'
    : 'rgba(255,42,109,0.8)';

  return (
    <div className="w-full h-full p-4 font-mono text-gray-100 pointer-events-none">
      {/* header */}
      <div className="flex justify-between items-center mb-4 px-3 py-2 border border-cyan-500 bg-black bg-opacity-50 rounded pointer-events-auto">
        <div className="flex items-center">
          <Hexagon className="text-cyan-400 mr-2" />
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-cyan-300 to-purple-500">
            SPINGLASS MARKET INDEX
          </h1>
          <Zap className="text-pink-500 ml-2" />
        </div>
        <div className="flex items-center">
          <div className={`px-2 rounded ${
              glitchIntensity>0.5
                ? 'bg-pink-500 animate-pulse'
                : 'bg-cyan-800'
            } pointer-events-auto`}>
            ENTROPY: {(glitchIntensity*100).toFixed(0)}%
          </div>
          <RefreshCw className="ml-2 text-cyan-400" />
        </div>
      </div>

      {/* chart */}
      <div className="relative h-64 mb-6 border border-pink-500 bg-black bg-opacity-30 rounded pointer-events-auto">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={marketData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="time" tick={false}/>
            <YAxis domain={['auto','auto']} tick={{ fill:'#9d00ff' }}/>
            <Tooltip contentStyle={{ background:'rgba(0,0,0,0.8)', borderColor:'#ff2a6d' }}/>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#05d9e8" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#ff2a6d" stopOpacity={0.2}/>
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="close"
              stroke="#05d9e8" fill="url(#grad)" isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer>
        {/* some glitch overlays */}
        {glitchIntensity > 0.6 && (
          <>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-1/2 h-1 bg-pink-500 opacity-30 animate-pulse"
                   style={{ transform:'skew(45deg)' }} />
              <div className="absolute top-2/4 left-1/3 w-1/3 h-1 bg-cyan-400 opacity-40 animate-ping"
                   style={{ transform:'skew(-30deg)' }} />
            </div>
          </>
        )}
      </div>

      {/* meme stocks */}
      <div className="pointer-events-auto mb-6 border border-purple-500 bg-black bg-opacity-40 rounded overflow-auto max-h-64">
        <div className="p-2 bg-gradient-to-r from-purple-900 to-pink-900 flex items-center">
          <GitBranch className="mr-2 text-purple-300" />
          <span className="text-lg font-bold">SPIN GLASS MEMETIC STOCKS</span>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-black bg-opacity-50">
            <tr>
              <th className="p-2 text-left">SYM</th>
              <th className="p-2 text-left">NAME</th>
              <th className="p-2 text-right">PRICE</th>
              <th className="p-2 text-right">Δ%</th>
              <th className="p-2 text-right">VOL</th>
            </tr>
          </thead>
          <tbody>
            {memeStocks.map(s=>(
              <tr key={s.id} className="border-t border-gray-800 hover:bg-purple-900 hover:bg-opacity-20">
                <td className="p-2 font-bold" style={{color:s.color}}>{s.id}</td>
                <td className="p-2">{s.name}</td>
                <td className="p-2 text-right">{s.price.toFixed(2)}</td>
                <td className={`p-2 text-right ${s.change>=0?'text-green-400':'text-red-400'}`}>
                  {s.change>=0?'+':''}{s.change.toFixed(2)}%
                </td>
                <td className="p-2 text-right">{s.volume.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* footer feed */}
      <div className="pointer-events-auto h-16 overflow-hidden border border-cyan-800 bg-black bg-opacity-60 rounded">
        <div className="text-xs text-gray-400 p-2 flex flex-wrap">
          {Array.from({length:20}).map((_,i)=>(
            <div key={i} className="mr-4 mb-1 flex items-center">
              <Code size={12} className="mr-1 text-cyan-500"/>
              <span className="text-gray-200">{Math.random().toString(16).substr(2,4)}</span>
              <span>:</span>
              <span className={Math.random()<0.5?'text-pink-400':'text-cyan-400'}>
                {(Math.random()*1000|0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
