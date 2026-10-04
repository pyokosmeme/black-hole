/* Small ZIP writer (stored entries), with CRC-32; no remote library needed. */
(function () {
  'use strict';
  const table=new Uint32Array(256);
  for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++) c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c;}
  function crc(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
  function record(size,values){const b=new Uint8Array(size),v=new DataView(b.buffer);for(const [offset,value,width] of values) width===2?v.setUint16(offset,value,true):v.setUint32(offset,value,true);return b;}
  function create(entries){
    const local=[],central=[];let offset=0,centralSize=0;
    for(const entry of entries){
      if(!entry.name||entry.name.startsWith('/')||entry.name.split('/').includes('..'))throw new Error('Invalid ZIP path');
      const name=new TextEncoder().encode(entry.name),data=typeof entry.data==='string'?new TextEncoder().encode(entry.data):new Uint8Array(entry.data),sum=crc(data);
      const header=record(30,[[0,0x04034b50],[4,20,2],[6,0x800,2],[12,33,2],[14,sum],[18,data.length],[22,data.length],[26,name.length,2]]);
      const dir=record(46,[[0,0x02014b50],[4,20,2],[6,20,2],[8,0x800,2],[14,33,2],[16,sum],[20,data.length],[24,data.length],[28,name.length,2],[42,offset]]);
      local.push(header,name,data);central.push(dir,name);offset+=header.length+name.length+data.length;centralSize+=dir.length+name.length;
    }
    const end=record(22,[[0,0x06054b50],[8,entries.length,2],[10,entries.length,2],[12,centralSize],[16,offset]]);
    return new Blob([...local,...central,end],{type:'application/zip'});
  }
  window.NeonZip={create};
})();
