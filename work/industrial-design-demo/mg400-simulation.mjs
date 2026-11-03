// Display feedback only; this module never opens a controller connection.
export function createMG400Simulation(){
 let elapsed=0,at=null,moving=false,mode=null,override=null;
 return {
  setRunning(value){override=value;},
  status(dataMode,physical,state,blocked=false,now=Date.now()){
   if(mode!==dataMode){mode=dataMode;override=null;at=null;moving=false;}
   if(at!==null&&moving)elapsed+=Math.max(0,now-at)/1000;
   at=now;
   if(dataMode==='real'||dataMode==='mixed'&&physical.online){
    moving=false;
    return {...physical,display:{...physical,source:'real'}};
   }
   moving=!blocked&&(override??(['running','warning'].includes(state?.mode)&&state?.quality!=='offline'));
   const step=Math.sin(elapsed*.65),round=value=>Math.round(value*100)/100;
   return {...physical,display:{
    source:'simulation',fallback:dataMode==='mixed',online:true,receivedAt:now,
    phase:blocked?'模拟联锁暂停':moving?'模拟运行':'模拟暂停',simulationRunning:moving,
    feedback:{robot_mode:moving?7:5,speed_scaling:20,error_status:false,digital_outputs:0,
     tool_vector_actual:[220,0,round(150+step*8),round(50+step*18)],
     q_actual:[round(step*20),round(15+step*12),round(-20+step*8),round(50+step*18)]}
   }};
  }
 };
}
