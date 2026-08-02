'use strict';

(function(root){
  let sequence=null;
  root.YearEngine={
    configure(handler){
      if(typeof handler!=='function') throw new TypeError('YearEngine requires a year sequence function.');
      sequence=handler;
    },
    advance(options){
      if(!sequence) throw new Error('YearEngine has not been configured.');
      const opts=options||{};
      return sequence(opts.suppressBurst,opts.quiet);
    },
    isConfigured(){ return typeof sequence==='function'; }
  };
})(typeof globalThis!=='undefined'?globalThis:this);
