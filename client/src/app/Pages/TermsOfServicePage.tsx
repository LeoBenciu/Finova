
const TermsOfServicePage = () => {
  return (
    <div className="max-w-4xl mx-auto p-6 bg-white overflow-y-scroll">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Termeni și Condiții de Utilizare - Next Corp
        </h1>
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>Ultima actualizare:</strong> 30.05.2025</p>
          <p><strong>Versiunea:</strong> 1.0</p>
        </div>
      </div>

      {/* Secțiunea 1 - Informații Generale */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Informații Generale</h2>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">1.1 Operatorul Serviciului</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p><strong>SC Next Corp SRL</strong></p>
            <p>Strada Principală nr. 223, sat Pâncești, comuna Pâncești, jud. Bacău, România</p>
            <p><strong>CUI:</strong> 47935139</p>
            <p><strong>Nr. Înregistrare:</strong> J04/577/2023</p>
            <p><strong>Telefon:</strong> +40725176707</p>
            <p><strong>Email:</strong> <a href="mailto:nextcorpromania@gmail.com" className="text-blue-600 hover:underline">nextcorpromania@gmail.com</a></p>
            <p><strong>Reprezentant legal:</strong> Benciu Leonardo-Constantin</p>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">1.2 Obiectul Serviciului</h3>
          <p className="text-gray-700 mb-3">
            Next Corp furnizează o platformă software pentru automatizarea proceselor contabile, care permite:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Digitalizarea și procesarea automată a documentelor contabile</li>
            <li>Extragerea de date din facturi și documente prin inteligență artificială</li>
            <li>Integrarea cu software-ul contabil existent</li>
            <li>Automatizarea introducerii datelor în sistemele contabile</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">1.3 Definiții</h3>
          <div className="space-y-2">
            <p className="text-gray-700"><strong>Serviciul/Platforma:</strong> Aplicația software Next Corp accesibilă online</p>
            <p className="text-gray-700"><strong>Utilizator:</strong> Persoana fizică sau juridică care utilizează Serviciul</p>
            <p className="text-gray-700"><strong>Cont:</strong> Profilul de utilizator creat în Platformă</p>
            <p className="text-gray-700"><strong>Conținut:</strong> Documentele, datele și informațiile încărcate de Utilizator</p>
          </div>
        </div>
      </section>

      {/* Secțiunea 2 - Acceptarea Termenilor */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Acceptarea Termenilor</h2>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">2.1 Acordul de Utilizare</h3>
          <p className="text-gray-700 mb-3">
            Prin accesarea și utilizarea Platformei, confirmați că:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Ați citit și înțeles acești Termeni și Condiții</li>
            <li>Acceptați să fiți legat de acești termeni</li>
            <li>Aveți capacitatea juridică de a încheia acest acord</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">2.2 Vârsta Minimă</h3>
          <p className="text-gray-700">
            Serviciul este destinat exclusiv persoanelor cu vârsta de minimum 18 ani sau reprezentanților legali ai persoanelor juridice.
          </p>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">2.3 Modificări ale Termenilor</h3>
          <p className="text-gray-700 mb-3">
            Ne rezervăm dreptul de a modifica acești termeni. Modificările vor fi comunicate prin:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Email către adresa înregistrată în cont</li>
            <li>Notificare în aplicație</li>
            <li>Publicarea pe site cu 30 zile înainte de intrarea în vigoare</li>
          </ul>
        </div>
      </section>

      {/* Secțiunea 3 - Crearea și Gestionarea Contului */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. Crearea și Gestionarea Contului</h2>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">3.1 Înregistrarea</h3>
          <p className="text-gray-700 mb-3">
            Pentru utilizarea Serviciului trebuie să:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Furnizați informații complete și exacte</li>
            <li>Creați un cont cu email valid</li>
            <li>Alegeți o parolă securizată</li>
            <li>Acceptați Politica de Confidențialitate</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">3.2 Responsabilitatea Contului</h3>
          <p className="text-gray-700 mb-3">
            Sunteți responsabil pentru:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Menținerea confidențialității parolei</li>
            <li>Toate activitățile desfășurate sub contul dumneavoastră</li>
            <li>Notificarea imediată în caz de acces neautorizat</li>
            <li>Actualizarea informațiilor de contact</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">3.3 Suspendarea Contului</h3>
          <p className="text-gray-700 mb-3">
            Ne rezervăm dreptul de a suspenda sau închide contul în cazul:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Încălcării acestor Termeni și Condiții</li>
            <li>Activității frauduloase sau ilegale</li>
            <li>Nerespectării obligațiilor de plată</li>
            <li>Solicitării Utilizatorului</li>
          </ul>
        </div>
      </section>

      {/* Secțiunea 4 - Utilizarea Serviciului */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Utilizarea Serviciului</h2>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">4.1 Licența de Utilizare</h3>
          <p className="text-gray-700 mb-3">
            Vă acordăm o licență limitată, non-exclusivă, netransmisibilă pentru:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Accesarea și utilizarea Platformei conform acestor termeni</li>
            <li>Încărcarea și procesarea documentelor contabile</li>
            <li>Utilizarea funcționalităților disponibile în planul ales</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">4.2 Restricții de Utilizare</h3>
          <p className="text-gray-700 mb-3">Este interzis să:</p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Utilizați Serviciul în scopuri ilegale sau neautorizate</li>
            <li>Încercați să accesați alte conturi sau sisteme</li>
            <li>Perturbați funcționarea Platformei</li>
            <li>Copiați, modificați sau distribuiți software-ul nostru</li>
            <li>Utilizați roboți, spider-uri sau alte metode automatizate neautorizate</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">4.3 Conținutul Utilizatorului</h3>
          <p className="text-gray-700 mb-3">
            Pentru documentele încărcate, garantați că:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Aveți dreptul legal de a le încărca și procesa</li>
            <li>Nu conțin informații confidențiale ale terților fără autorizație</li>
            <li>Nu încalcă drepturi de proprietate intelectuală</li>
            <li>Respectă legislația aplicabilă privind protecția datelor</li>
          </ul>
        </div>
      </section>

      {/* Secțiunea 5 - Planuri de Abonament și Plăți */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Planuri de Abonament și Plăți</h2>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">5.1 Planuri Disponibile</h3>
          <p className="text-gray-700 mb-4">
            Oferim mai multe planuri de abonament cu funcționalități diferite:
          </p>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-2">Plan Trial</h4>
              <p className="text-gray-700 text-sm">14 zile gratuite cu toate funcționalitățile</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-2">Plan Professional</h4>
              <p className="text-gray-700 text-sm">199 RON/lună + TVA - Funcționalități complete pentru firme de contabilitate</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-2">Plan Enterprise</h4>
              <p className="text-gray-700 text-sm">Soluții personalizate pentru organizații mari (preț la cerere)</p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">5.2 Prețuri și Facturare</h3>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Prețurile sunt afișate în RON + TVA (19%)</li>
            <li>Facturarea se face lunar, prima taxă după perioada de trial de 14 zile</li>
            <li>Plățile se procesează automat prin card bancar sau transfer bancar</li>
            <li>Acceptăm plăți prin card bancar și transfer bancar prin procesatori autorizați</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">5.3 Politica de Rambursare</h3>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li><strong>Plan Trial:</strong> Gratuit 14 zile, fără obligații</li>
            <li><strong>Plan Professional:</strong> Rambursare completă în primele 14 zile de la prima plată</li>
            <li><strong>Anulări:</strong> Serviciul rămâne activ până la sfârșitul perioadei plătite</li>
            <li><strong>Excepții:</strong> Nu se rambursează în caz de încălcare a termenilor</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">5.4 Întârzieri la Plată</h3>
          <p className="text-gray-700 mb-3">În caz de neplată:</p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Serviciul poate fi suspendat după 7 zile de întârziere</li>
            <li>Se aplică taxe de întârziere conform legislației</li>
            <li>Contul poate fi închis după 30 zile de neplată</li>
          </ul>
        </div>
      </section>

      {/* Secțiunea 6 - Proprietatea Intelectuală */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">6. Proprietatea Intelectuală</h2>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">6.1 Drepturi Next Corp</h3>
          <p className="text-gray-700 mb-3">
            Platforma, software-ul, designul și toate materialele asociate sunt proprietatea Next Corp și sunt protejate de:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Drepturi de autor</li>
            <li>Mărci înregistrate</li>
            <li>Secrete comerciale</li>
            <li>Alte drepturi de proprietate intelectuală</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">6.2 Drepturi Utilizator</h3>
          <p className="text-gray-700 mb-3">
            Păstrați toate drepturile asupra documentelor și datelor încărcate. Prin utilizarea Serviciului, ne acordați:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Licența de procesare necesară furnizării serviciului</li>
            <li>Dreptul de stocare temporară pentru procesare</li>
            <li>Dreptul de îmbunătățire a algoritmilor (în mod anonimizat)</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">6.3 Feedback și Sugestii</h3>
          <p className="text-gray-700">
            Orice feedback furnizat devine proprietatea Next Corp și poate fi utilizat pentru îmbunătățirea Serviciului fără obligații față de dumneavoastră.
          </p>
        </div>
      </section>

      {/* Secțiunea 7 - Protecția Datelor */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">7. Protecția Datelor și Confidențialitatea</h2>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">7.1 Politica de Confidențialitate</h3>
          <p className="text-gray-700">
            Prelucrarea datelor cu caracter personal se realizează conform Politicii noastre de Confidențialitate, care face parte integrantă din acești termeni.
          </p>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">7.2 Securitatea Datelor</h3>
          <p className="text-gray-700 mb-3">
            Implementăm măsuri tehnice și organizatorice pentru protecția datelor:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Criptarea în tranzit și în repaus</li>
            <li>Controlul accesului și autentificarea</li>
            <li>Monitorizarea și jurnalizarea activității</li>
            <li>Backup-uri regulate și securizate</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">7.3 Transferuri Internaționale</h3>
          <p className="text-gray-700">
            Unele date pot fi procesate de furnizorii noștri din afara SEE, cu garanții adecvate conform GDPR.
          </p>
        </div>
      </section>

      {/* Secțiunea 8 - Disponibilitatea Serviciului */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">8. Disponibilitatea Serviciului</h2>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">8.1 Nivel de Serviciu</h3>
          <p className="text-gray-700 mb-3">
            Ne străduim să menținem Serviciul disponibil 99.5% din timp lunar, excluzând:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Întreținerea programată (anunțată în avans)</li>
            <li>Circumstanțe de forță majoră</li>
            <li>Probleme ale furnizorilor terți</li>
            <li>Atacuri cibernetice sau probleme de securitate</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">8.2 Întreținerea</h3>
          <p className="text-gray-700">
            Întreținerea programată se realizează cu preaviz de minimum 24 ore și de preferință în intervalele cu trafic redus.
          </p>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">8.3 Backup și Recuperare</h3>
          <p className="text-gray-700">
            Efectuăm backup-uri regulate ale datelor, dar recomandăm utilizatorilor să păstreze copii locale ale documentelor importante.
          </p>
        </div>
      </section>

      {/* Secțiunea 9 - Limitarea Răspunderii */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">9. Limitarea Răspunderii</h2>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">9.1 Limitări Generale</h3>
          <p className="text-gray-700 mb-3">
            Răspunderea Next Corp este limitată la:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Valoarea plătită pentru Serviciu în ultimele 12 luni</li>
            <li>Daunele directe și previzibile</li>
            <li>Excluderea daunelor indirecte, consecințiale sau a pierderii de profit</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">9.2 Excluderi de Răspundere</h3>
          <p className="text-gray-700 mb-3">Nu răspundem pentru:</p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Pierderea de date cauzată de utilizarea necorespunzătoare</li>
            <li>Întreruperi cauzate de factori externi</li>
            <li>Daunele cauzate de încălcarea acestor termeni de către utilizator</li>
            <li>Inexactitățile în procesarea automată a documentelor</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">9.3 Utilizarea pe Propriul Risc</h3>
          <p className="text-gray-700 mb-3">
            Serviciul este furnizat ca atare, fără garanții explicite sau implicite privind:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Disponibilitatea neîntreruptă</li>
            <li>Absența erorilor</li>
            <li>Compatibilitatea cu toate sistemele</li>
            <li>Rezultatele specifice ale procesării</li>
          </ul>
        </div>
      </section>

      {/* Secțiunea 10 - Încetarea Serviciului */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">10. Încetarea Serviciului</h2>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">10.1 Încetarea de către Utilizator</h3>
          <p className="text-gray-700 mb-3">Puteți înceta utilizarea prin:</p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Anularea abonamentului direct din aplicația dumneavoastră (Setări Cont)</li>
            <li>Solicitare prin email la nextcorpromania@gmail.com ca metodă alternativă</li>
          </ul>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
            <p className="text-yellow-800 text-sm">
              <strong>Important:</strong> Serviciul rămâne activ până la sfârșitul perioadei plătite. Datele se șterg automat și imediat la anularea contului.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">10.2 Încetarea de către Next Corp</h3>
          <p className="text-gray-700 mb-3">Putem înceta Serviciul în următoarele cazuri:</p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Încălcarea acestor Termeni și Condiții</li>
            <li>Activitate frauduloasă sau ilegală</li>
            <li>Neplata serviciilor după perioada de grație</li>
            <li>Încetarea activității Next Corp (cu preaviz de 90 zile)</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">10.3 Efectele Încetării</h3>
          <p className="text-gray-700 mb-3">La încetarea serviciului:</p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Accesul la Platformă se suspendă imediat</li>
            <li>Toate datele se șterg automat și definitiv din sistemele noastre</li>
            <li>Obligațiile financiare pentru perioada utilizată rămân valabile</li>
          </ul>
        </div>
      </section>

      {/* Secțiunea 11 - Dispoziții Legale */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">11. Dispoziții Legale</h2>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">11.1 Legea Aplicabilă</h3>
          <p className="text-gray-700">
            Acești termeni sunt guvernați de legea română și se interpretează conform acesteia.
          </p>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">11.2 Jurisdicția</h3>
          <p className="text-gray-700">
            Orice dispute se vor soluționa pe cale amiabilă sau prin instanțele competente din România, Județul Bacău.
          </p>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">11.3 Forța Majoră</h3>
          <p className="text-gray-700">
            Nu răspundem pentru neexecutarea obligațiilor cauzată de evenimente de forță majoră: calamități naturale, războaie, atacuri cibernetice majore, modificări legislative etc.
          </p>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">11.4 Divisibilitate</h3>
          <p className="text-gray-700">
            Dacă o prevedere din acești termeni devine invalidă, restul prevederilor rămân în vigoare.
          </p>
        </div>
      </section>

      {/* Secțiunea 12 - Contact și Suport */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">12. Contact și Suport</h2>
        
        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">12.1 Informații Contact</h3>
          <p className="text-gray-700 mb-3">Pentru întrebări, reclamații sau suport tehnic:</p>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p><strong>Email:</strong> <a href="mailto:nextcorpromania@gmail.com" className="text-blue-600 hover:underline">nextcorpromania@gmail.com</a></p>
            <p><strong>Telefon:</strong> +40725176707</p>
            <p><strong>Program:</strong> Luni-Vineri, 08:00-17:00 (ora București)</p>
            <p><strong>Adresă:</strong> Strada Principală nr. 223, sat Pâncești, comuna Pâncești, jud. Bacău, România</p>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">12.2 Timp de Răspuns</h3>
          <p className="text-gray-700 mb-3">Ne străduim să răspundem la:</p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Întrebări generale și probleme tehnice: maximum 1 oră în timpul programului</li>
            <li>Urgențe de securitate: imediat</li>
            <li>În afara programului: prima zi lucrătoare</li>
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-medium text-gray-800 mb-3">12.3 Soluționarea Disputelor</h3>
          <p className="text-gray-700 mb-3">
            Încurajăm soluționarea amiabilă a disputelor. Pentru reclamații nerezolvate, puteți apela la:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Autoritatea Națională pentru Protecția Consumatorilor (ANPC)</li>
            <li>Platforma Online de Soluționare a Disputelor (ODR) a UE</li>
          </ul>
        </div>
      </section>

      {/* Footer */}
      <div className="border-t pt-6 mt-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-blue-800 text-sm text-center">
            Prin utilizarea Serviciului Next Corp, confirmați că ați citit, înțeles și acceptat acești Termeni și Condiții în integralitatea lor.
          </p>
        </div>
        <div className="text-center text-sm text-gray-600">
          <p><strong>SC Next Corp SRL</strong></p>
          <p>Data actualizării: 30.05.2025</p>
        </div>
      </div>
    </div>
  )
}

export default TermsOfServicePage
