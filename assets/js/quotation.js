(function(){
  var KEY='quantals-quotation-v1';
  var CUR='ZMK ';
  function sample(){return {
    coName:'Quantals Solution',tagline:'delivering the Best',coAddr1:'PHI off Great East Road',coAddr2:'Lusaka Zambia',coPhone:'Phone +260977445615',
    date:'2026-08-20',qno:'000072',cid:'',valid:'2026-12-01',prep:'Richard Mumba',
    toName:'Purchasing Officer',toOrg:'ZESCO',toAddr1:'Great East Road',toAddr2:'Lusaka Zambia',toPhone:'',
    comments:'None',sales:'Richard Mumba',po:'Non',shipDate:'N/A',shipVia:'N/A',fob:'',terms:'Due on receipt',
    notes:'',rate:8.6,other:0,
    footer:'If you have any questions concerning this quotation contact Richard Mumba at 0977445615 or Email: dataquantals@gmail.com',
    items:[{q:13,d:'Empty Carton Boxes',p:150,t:''}].concat(Array.from({length:8},function(){return {q:'',d:'',p:'',t:''}}))
  }}
  var S;
  try{var raw=localStorage.getItem(KEY);S=raw?JSON.parse(raw):sample()}catch(e){S=sample()}
  if(!S||!S.items)S=sample();

  var $=function(id){return document.getElementById(id)};
  var rowsEl=$('rows');
  function money(n){return CUR+(Number(n)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
  function num(v){var n=parseFloat(v);return isNaN(n)?0:n}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(S));$('status').textContent='Saved in this browser.'}catch(e){$('status').textContent='Not saved (browser storage blocked).'}}

  function buildRows(){
    rowsEl.innerHTML='';
    S.items.forEach(function(it,i){
      var tr=document.createElement('tr');tr.dataset.i=i;
      tr.innerHTML='<td><input type="number" min="0" step="any" data-f="q" aria-label="Quantity"></td>'+
        '<td><input data-f="d" aria-label="Description"></td>'+
        '<td class="n"><input type="number" min="0" step="any" data-f="p" aria-label="Unit price"></td>'+
        '<td class="c"><select data-f="t" aria-label="Taxable"><option value="">No</option><option value="T">T</option></select></td>'+
        '<td class="amt" data-a></td>'+
        '<td class="x"><button class="rm" type="button" data-rm aria-label="Remove line">&times;</button></td>';
      tr.querySelectorAll('[data-f]').forEach(function(el){el.value=it[el.dataset.f]});
      rowsEl.appendChild(tr);
    });
    calc();
  }
  function calc(){
    var sub=0,taxable=0;
    S.items.forEach(function(it,i){
      var a=num(it.q)*num(it.p); // AMOUNT = QUANTITY x UNIT PRICE
      sub+=a; if(it.t==='T')taxable+=a;
      var c=rowsEl.children[i]&&rowsEl.children[i].querySelector('[data-a]');
      if(c)c.textContent=(it.q===''&&it.p==='')?'':money(a);
    });
    var tax=num(S.rate)/100*taxable; // SALES TAX = rate x sum of taxable lines
    var total=sub+tax+num(S.other);   // TOTAL = subtotal + tax + other
    $('sub').textContent=money(sub);$('tax').textContent=money(tax);$('total').textContent=money(total);
    return {sub:sub,tax:tax,total:total};
  }
  function fillFields(){
    document.querySelectorAll('[data-k]').forEach(function(el){el.value=S[el.dataset.k]==null?'':S[el.dataset.k]});
    $('rate').value=S.rate;$('other').value=S.other;
  }
  document.addEventListener('input',function(e){
    var el=e.target;
    if(el.dataset.k){S[el.dataset.k]=el.value}
    else if(el.id==='rate'){S.rate=el.value}
    else if(el.id==='other'){S.other=el.value}
    else if(el.dataset.f){var i=el.closest('tr').dataset.i;S.items[i][el.dataset.f]=el.value}
    else return;
    calc();save();
  });
  rowsEl.addEventListener('click',function(e){
    var b=e.target.closest('[data-rm]');if(!b)return;
    S.items.splice(+b.closest('tr').dataset.i,1);
    if(!S.items.length)S.items.push({q:'',d:'',p:'',t:''});
    buildRows();save();
  });
  $('addRow').onclick=function(){S.items.push({q:'',d:'',p:'',t:''});buildRows();save();
    var r=rowsEl.lastElementChild;if(r)r.querySelector('input').focus()};
  $('newQ').onclick=function(){
    var n=String((parseInt(S.qno,10)||0)+1).padStart(String(S.qno||'000000').length,'0');
    var d=new Date(),iso=d.toISOString().slice(0,10);
    var v=new Date(d.getTime()+14*864e5).toISOString().slice(0,10);
    S.qno=n;S.date=iso;S.valid=v;S.items=Array.from({length:9},function(){return {q:'',d:'',p:'',t:''}});S.other=0;
    fillFields();buildRows();save();
  };
  $('reset').onclick=function(){S=sample();fillFields();buildRows();save()};
  $('copy').onclick=function(){
    var t=calc(),lines=['Quotation #'+S.qno+' | '+S.date,'For: '+S.toOrg+' ('+S.toName+')',''];
    S.items.forEach(function(it){if(num(it.q)||num(it.p))lines.push(it.q+' x '+it.d+' @ '+money(it.p)+' = '+money(num(it.q)*num(it.p)))});
    lines.push('','Subtotal: '+money(t.sub),'Sales tax ('+S.rate+'%): '+money(t.tax),'Other: '+money(S.other),'Total: '+money(t.total));
    var txt=lines.join('\n'),st=$('status');
    (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(function(){st.textContent='Summary copied.'},function(){
      var ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();
      try{document.execCommand('copy');st.textContent='Summary copied.'}catch(e){st.textContent='Copy blocked by this browser.'}
      ta.remove()});
  };
  /* Download the sheet as a PDF (html2pdf), falling back to the browser
     print dialog — which also offers "Save as PDF". */
  var dlBtn = $('downloadPdf');
  if (dlBtn) dlBtn.onclick = function () {
    var st = $('status');
    var sheet = document.querySelector('.sheet');
    if (!sheet) return;
    try {
      if (typeof html2pdf === 'function') {
        st.textContent = 'Preparing PDF…';
        html2pdf().set({
          margin: [8, 8, 8, 8],
          filename: 'Quotation-' + (S.qno || '000000') + '.pdf',
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(sheet).save().then(
          function () { st.textContent = 'PDF downloaded.'; },
          function () { st.textContent = 'Could not build the PDF.'; }
        );
      } else {
        window.print();
      }
    } catch (e) { window.print(); }
  };

  fillFields();buildRows();
})();
