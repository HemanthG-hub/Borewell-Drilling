import React, { useEffect, useRef, useState } from "react";
import { PulseIcon, ArrowUpIcon, ArrowDownIcon } from "@phosphor-icons/react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || window.location.origin;

function wsUrl() {
  const url = new URL(BACKEND_URL);
  const proto = url.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${url.host}/api/ws/live`;
}

const Metric = ({ label, value, unit, prev, dangerAbove, dangerBelow }) => {
  const numeric = typeof value === "number" ? value : parseFloat(value);
  const prevN = typeof prev === "number" ? prev : parseFloat(prev);
  const delta = !isNaN(prevN) ? numeric - prevN : 0;
  const isDanger = (dangerAbove !== undefined && numeric > dangerAbove) || (dangerBelow !== undefined && numeric < dangerBelow);
  return (
    <div className="flex-1 min-w-[110px] border-r border-[#262626] px-4 py-2" data-testid={`ticker-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="text-[9px] tracking-widest text-[#71717A]">{label}</div>
      <div className={`font-display text-xl ${isDanger ? "text-[#FF3B30]" : "text-white"}`}>
        {value ?? "—"} <span className="text-[10px] text-[#71717A] font-mono">{unit}</span>
      </div>
      {delta !== 0 && !isNaN(delta) && (
        <div className={`text-[10px] font-mono flex items-center gap-1 ${delta > 0 ? "text-[#FFB000]" : "text-[#34C759]"}`}>
          {delta > 0 ? <ArrowUpIcon size={9} weight="bold" /> : <ArrowDownIcon size={9} weight="bold" />}
          {Math.abs(delta).toFixed(2)}
        </div>
      )}
    </div>
  );
};

export default function LiveTicker() {
  const [tick, setTick] = useState(null);
  const [prev, setPrev] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    let reconnectTimer = null;

    const connect = () => {
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;
      ws.onopen = () => mounted && setConnected(true);
      ws.onmessage = (e) => {
        if (!mounted) return;
        try {
          const data = JSON.parse(e.data);
          setTick(prevTick => {
            setPrev(prevTick);
            return data;
          });
        } catch (err) {
          console.error("Failed to parse LiveTicker WebSocket message:", err);
        }
      };
      ws.onclose = () => {
        if (!mounted) return;
        setConnected(false);
        reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => {
      mounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="border border-[#262626] bg-[#121212]" data-testid="live-ticker">
      <div className="px-4 py-2 border-b border-[#262626] flex justify-between items-center">
        <div className="flex items-center gap-2">
          <PulseIcon size={14} weight="fill" className={connected ? "text-[#34C759]" : "text-[#71717A]"} />
          <div className="font-display font-bold text-xs tracking-widest">LIVE RIG FEED</div>
          <span className={`pill ${connected ? "pill-success" : "pill-muted"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[#34C759] animate-pulse" : "bg-[#71717A]"}`}></span>
            {connected ? "STREAMING" : "OFFLINE"}
          </span>
        </div>
        <div className="text-[10px] text-[#71717A] font-mono">
          {tick ? `${tick.well_name} · ${new Date(tick.timestamp).toLocaleTimeString()}` : "connecting..."}
        </div>
      </div>
      <div className="flex overflow-x-auto">
        <Metric label="DEPTH" value={tick?.depth_ft} prev={prev?.depth_ft} unit="ft" />
        <Metric label="ROP" value={tick?.rop_ft_hr} prev={prev?.rop_ft_hr} unit="ft/h" dangerBelow={15} />
        <Metric label="TORQUE" value={tick?.torque_kftlbs} prev={prev?.torque_kftlbs} unit="kft·lbs" dangerAbove={22} />
        <Metric label="MUD WT" value={tick?.mud_weight_ppg} prev={prev?.mud_weight_ppg} unit="ppg" />
        <Metric label="FLOW" value={tick?.flow_gpm} prev={prev?.flow_gpm} unit="gpm" />
        <Metric label="WOB" value={tick?.wob_klbs} prev={prev?.wob_klbs} unit="klbs" />
      </div>
    </div>
  );
}
