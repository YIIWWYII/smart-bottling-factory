import {useState} from 'react';
import {CircleHelp} from 'lucide-react';
import {Modal} from './ui';
export default function ConfigurationHelp({title='配置说明',children}){
 const [open,setOpen]=useState(false);
 return <><button type="button" className="configuration-help-button" aria-label={title} title={title} onClick={()=>setOpen(true)}><CircleHelp size={22}/></button>{open&&<Modal className="configuration-help-dialog" title={title} onClose={()=>setOpen(false)}><div className="configuration-help-content">{children}</div></Modal>}</>;
}
