import sys
import warnings
import base64
import os
import json
import csv
import logging
import gc
import tempfile
import tracemalloc
import traceback
import hashlib
import time
from typing import Dict, Any, Optional, List
from io import StringIO
from contextlib import redirect_stdout, redirect_stderr
from datetime import datetime

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stderr)]
)

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

try:
    from crew import FirstCrewFinova
    print("Successfully imported FirstCrewFinova", file=sys.stderr)
except Exception as e:
    print(f"ERROR: Failed to import FirstCrewFinova: {str(e)}", file=sys.stderr)
    print(f"Traceback: {traceback.format_exc()}", file=sys.stderr)
    sys.exit(1)

def get_romanian_chart_of_accounts():
    """Get the Romanian chart of accounts from the backend service."""
    # Try multiple possible paths to find the backend file
    possible_paths = [
        # Direct absolute path (most reliable)
        '/Users/test/Desktop/Projects/Finova/server/finova/src/utils/romanianChartOfAccounts.ts',
        # Path from agents directory to backend
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', '..', 'server', 'finova', 'src', 'utils', 'romanianChartOfAccounts.ts'),
        # Alternative path structure
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'server', 'finova', 'src', 'utils', 'romanianChartOfAccounts.ts'),
        # Direct path if running from project root
        'server/finova/src/utils/romanianChartOfAccounts.ts',
        # Relative path from current working directory
        os.path.join(os.getcwd(), 'server', 'finova', 'src', 'utils', 'romanianChartOfAccounts.ts')
    ]
    
    for backend_utils_path in possible_paths:
        try:
            print(f"Trying path: {backend_utils_path}", file=sys.stderr)
            if os.path.exists(backend_utils_path):
                with open(backend_utils_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # Extract the chart of accounts from the TypeScript file
                    start_marker = 'export const ROMANIAN_CHART_OF_ACCOUNTS = `'
                    end_marker = '`'
                    
                    start_idx = content.find(start_marker)
                    if start_idx != -1:
                        start_idx += len(start_marker)
                        # Find the matching closing backtick (use rfind to get the last occurrence)
                        end_idx = content.rfind(end_marker)
                        if end_idx != -1 and end_idx > start_idx:
                            chart_content = content[start_idx:end_idx].strip()
                            print(f"✅ Successfully loaded Romanian chart of accounts from: {backend_utils_path}", file=sys.stderr)
                            print(f"✅ Chart content length: {len(chart_content)} characters", file=sys.stderr)
                            print(f"✅ Chart content preview: {chart_content[:200]}...", file=sys.stderr)
                            if len(chart_content) > 1000:  # Ensure we have substantial content
                                return chart_content
                            else:
                                print(f"⚠️  Chart content too short ({len(chart_content)} chars), trying next path", file=sys.stderr)
                        else:
                            print(f"❌ Could not find matching end marker in: {backend_utils_path}", file=sys.stderr)
                    else:
                        print(f"❌ Could not find start marker in: {backend_utils_path}", file=sys.stderr)
        except Exception as e:
            print(f"Error with path {backend_utils_path}: {str(e)}", file=sys.stderr)
            continue
    
    print(f"🚨 CRITICAL ERROR: Could not load Romanian Chart of Accounts from any path!", file=sys.stderr)
    print(f"🚨 This will cause AI extraction to fail and return empty responses!", file=sys.stderr)
    print(f"🚨 Please check that the file exists at: /Users/test/Desktop/Projects/Finova/server/finova/src/utils/romanianChartOfAccounts.ts", file=sys.stderr)
    
    # Minimal fallback - just the most common account codes
    return """
        ROMANIAN_CHART_OF_ACCOUNTS:

    Clasa 1 - Conturi de capitaluri, provizioane, imprumuturi si datorii asimilate
        10. Capital si rezerve
            101. Capital
                1011. Capital subscris nevarsat (P)
                1012. Capital subscris varsat (P)
                1015. Patrimoniul regiei (P)
                1016. Patrimoniul public (P)
                1017. Patrimoniul privat (P)
                1018. Patrimoniul institutelor nationale de cercetare-dezvoltare (P)
            103. Alte elemente de capitaluri proprii
                1031. Beneficii acordate angajatilor sub forma instrumentelor de capitaluri proprii (P)
                1033. Diferente de curs valutar in relatie cu investitia neta intr-o entitate straina (A/P)
                1038. Diferente din modificarea valorii juste a activelor financiare disponibile in vederea vanzarii si alte elemente de capitaluri proprii (A/P)
            104. Prime de capital
                1041. Prime de emisiune (P)
                1042. Prime de fuziune/divizare (P)
                1043. Prime de aport (P)
                1044. Prime de conversie a obligatiunilor in actiuni (P)
            105. Rezerve din reevaluare (P)
            106. Rezerve
                1061. Rezerve legale (P)
                1063. Rezerve statutare sau contractuale (P)
                1068. Alte rezerve (P)
            107. Diferente de curs valutar din conversie (A/P)
            108. Interese care nu controleaza
                1081. Interese care nu controleaza - rezultatul exercitiului financiar (A/P)
                1082. Interese care nu controleaza - alte capitaluri proprii (A/P)
            109. Actiuni proprii
                1091. Actiuni proprii detinute pe termen scurt (A)
                1092. Actiuni proprii detinute pe termen lung (A)
                1095. Actiuni proprii reprezentand titluri detinute de societatea absorbita la societatea absorbanta (A)
        11. Rezultatul reportat
            117. Rezultatul reportat
                1171. Rezultatul reportat reprezentand profitul nerepartizat sau pierderea neacoperita (A/P)
                1172. Rezultatul reportat provenit din adoptarea pentru prima data a IAS, mai putin IAS 29* (A/P)
                1173. Rezultatul reportat provenit din modificarile politicilor contabile (A/P)
                1174. Rezultatul reportat provenit din corectarea erorilor contabile (A/P)
                1175. Rezultatul reportat reprezentand surplusul realizat din rezerve din reevaluare (P)
                1176. Rezultatul reportat provenit din trecerea la aplicarea reglementarilor contabile conforme cu directivele europene (A/P)
        12. Rezultatul exercitiului financiar
            121. Profit sau pierdere (A/P)
            129. Repartizarea profitului (A)
        14. Castiguri sau pierderi legate de emiterea, rascumpararea, vanzarea, cedarea cu titlu gratuit sau anularea instrumentelor de capitaluri proprii
            141. Castiguri legate de vanzarea sau anularea instrumentelor de capitaluri proprii
                1411. Castiguri legate de vanzarea instrumentelor de capitaluri proprii (P)
                1412. Castiguri legate de anularea instrumentelor de capitaluri proprii (P)
            149. Pierderi legate de emiterea, rascumpararea, vanzarea, cedarea cu titlu gratuit sau anularea instrumentelor de capitaluri proprii
                1491. Pierderi rezultate din vanzarea instrumentelor de capitaluri proprii (A)
                1495. Pierderi rezultate din reorganizari, care sunt determinate de anularea titlurilor detinute (A)
                1496 Pierderi rezultate din reorganizari de societati, corespunzatoare activului net negativ al societatii absorbite
                1498. Alte pierderi legate de instrumentele de capitaluri proprii (A)
        15. Provizioane
            151. Provizioane
                1511. Provizioane pentru litigii (P)
                1512. Provizioane pentru garantii acordate clientilor (P)
                1513. Provizioane pentru dezafectare imobilizari corporale si alte actiuni similare legate de acestea (P)
                1514. Provizioane pentru restructurare (P)
                1515. Provizioane pentru pensii si obligatii similare (P)
                1516. Provizioane pentru impozite (P)
                1517. Provizioane pentru terminarea contractului de munca (P)
                1518. Alte provizioane (P)
        16. Imprumuturi si datorii asimilate
            161. Imprumuturi din emisiuni de obligatiuni
                1614. Imprumuturi externe din emisiuni de obligatiuni garantate de stat (P)
                1615. Imprumuturi externe din emisiuni de obligatiuni garantate de banci (P)
                1617. Imprumuturi interne din emisiuni de obligatiuni garantate de stat (P)
                1618. Alte imprumuturi din emisiuni de obligatiuni (P)
            162. Credite bancare pe termen lung
                1621. Credite bancare pe termen lung (P)
                1622. Credite bancare pe termen lung nerambursate la scadenta (P)
                1623. Credite externe guvernamentale (P)
                1624. Credite bancare externe garantate de stat (P)
                1625. Credite bancare externe garantate de banci (P)
                1626. Credite de la trezoreria statului (P)
                1627. Credite bancare interne garantate de stat (P)
            166. Datorii care privesc imobilizarile financiare
                1661. Datorii fata de entitatile afiliate (P)
                1663. Datorii fata de entitatile asociate si entitatile controlate in comun (P)
            167. Alte imprumuturi si datorii asimilate (P)
            168. Dobanzi aferente imprumuturilor si datoriilor asimilate
                1681. Dobanzi aferente imprumuturilor din emisiuni de obligatiuni (P)
                1682. Dobanzi aferente creditelor bancare pe termen lung (P)
                1685. Dobanzi aferente datoriilor fata de entitatile afiliate (P)
                1686. Dobanzi aferente datoriilor fata de entitatile asociate si entitatile controlate in comun (P)
                1687. Dobanzi aferente altor imprumuturi si datorii asimilate (P)
            169. Prime privind rambursarea obligatiunilor si a altor datorii
                1691. Prime privind rambursarea obligatiunilor (A)
                1692. Prime privind rambursarea altor datorii (A)
    
    Clasa 2 - Conturi de imobilizari
        20. IMOBILIZARI NECORPORALE
            201. Cheltuieli de constituire (A)
            203. Cheltuieli de dezvoltare (A)
            205. Concesiuni, brevete, licente, marci comerciale, drepturi si active similare (A)
            206. Active necorporale de explorare si evaluare a resurselor minerale (A)
            207. Fond comercial
                2071. Fond comercial pozitiv (A)
                2075. Fond comercial negativ (P)
            208. Alte imobilizari necorporale (A)
        21. Imobilizari corporale
            211. Terenuri si amenajari de terenuri (A)
                2111. Terenuri
                2112. Amenajari de terenuri
            212. Constructii (A)
            213. Instalatii tehnice si mijloace de transport
                2131. Echipamente tehnologice (masini, utilaje si instalatii de lucru) (A)
                2132. Aparate si instalatii de masurare, control si reglare (A)
                2133. Mijloace de transport (A)
            214. Mobilier, aparatura birotica, echipamente de protectie a valorilor umane si materiale si alte active corporale (A)
            215. Investitii imobiliare (A)
            216. Active corporale de explorare si evaluare a resurselor minerale (A)
            217. Active biologice productive (A)
        22. Imobilizari corporale in curs de aprovizionare
            223. Instalatii tehnice si mijloace de transport in curs de aprovizionare (A)
            224. Mobilier, aparatura birotica, echipamente de protectie a valorilor umane si materiale si alte active corporale in curs de aprovizionare (A)
            227. Active biologice productive in curs de aprovizionare (A)
        23. Imobilizari in curs
            231. Imobilizari corporale in curs de executie (A)
            235. Investitii imobiliare in curs de executie (A)
        26. Imobilizari financiare
            261. Actiuni detinute la entitatile afiliate (A)
            262. Actiuni detinute la entitati asociate (A)
            263. Actiuni detinute la entitati controlate in comun (A)
            264. Titluri puse in echivalenta (A)
            265. Alte titluri imobilizate (A)
            266. Certificate verzi amanate (A)
            267. Creante imobilizate
                2671. Sume de incasat de la entitatile afiliate (A)
                2672. Dobanda aferenta sumelor de incasat de la entitatile afiliate (A)
                2673. Creante fata de entitatile asociate si entitatile controlate in comun (A)
                2674. Dobanda aferenta creantelor fata de entitatile asociate si entitatile controlate in comun (A)
                2675. Imprumuturi acordate pe termen lung (A)
                2676. Dobanda aferenta imprumuturilor acordate pe termen lung (A)
                2677. Obligatiuni achizitionate cu ocazia emisiunilor efectuate de terti (A)
                2678. Alte creante imobilizate (A)
                2679. Dobanzi aferente altor creante imobilizate (A)
            269. Varsaminte de efectuat pentru imobilizari financiare
                2691. Varsaminte de efectuat privind actiunile detinute la entitatile afiliate (P)
                2692. Varsaminte de efectuat privind actiunile detinute la entitati asociate (P)
                2693. Varsaminte de efectuat privind actiunile detinute la entitati controlate in comun (P)
                2695. Varsaminte de efectuat pentru alte imobilizari financiare (P)
        28. Amortizari privind imobilizarile
            280. Amortizari privind imobilizarile necorporale
                2801. Amortizarea cheltuielilor de constituire (P)
                2803. Amortizarea cheltuielilor de dezvoltare (P)
                2805. Amortizarea concesiunilor, brevetelor, licentelor, marcilor comerciale, drepturilor si activelor similare (P)
                2806. Amortizarea activelor necorporale de explorare si evaluare a resurselor minerale (P)
                2807. Amortizarea fondului comercial (P)
                2808. Amortizarea altor imobilizari necorporale (P)
            281. Amortizari privind imobilizarile corporale
                2811. Amortizarea amenajarilor de terenuri (P)
                2812. Amortizarea constructiilor (P)
                2813. Amortizarea instalatiilor si mijloacelor de transport (P)
                2814. Amortizarea altor imobilizari corporale (P)
                2815. Amortizarea investitiilor imobiliare (P)
                2816. Amortizarea activelor corporale de explorare si evaluare a resurselor minerale (P)
                2817. Amortizarea activelor biologice productive (P)
        29. Ajustari pentru deprecierea sau pierderea de valoare a imobilizarilor
            290. Ajustari pentru deprecierea imobilizarilor necorporale
                2903. Ajustari pentru deprecierea cheltuielilor de dezvoltare (P)
                2905. Ajustari pentru deprecierea concesiunilor, brevetelor, licentelor, marcilor comerciale, drepturilor si activelor similare (P)
                2906. Ajustari pentru deprecierea activelor necorporale de explorare si evaluare a resurselor minerale (P)
                2908. Ajustari pentru deprecierea altor imobilizari necorporale (P)
            291. Ajustari pentru deprecierea imobilizarilor corporale
                2911. Ajustari pentru deprecierea terenurilor si amenajarilor de terenuri (P)
                2912. Ajustari pentru deprecierea constructiilor (P)
                2913. Ajustari pentru deprecierea instalatiilor si mijloacelor de transport (P)
                2914. Ajustari pentru deprecierea altor imobilizari corporale (P)
                2915. Ajustari pentru deprecierea investitiilor imobiliare (P)
                2916. Ajustari pentru deprecierea activelor corporale de explorare si evaluare a resurselor minerale (P)
                2917. Ajustari pentru deprecierea activelor biologice productive (P)
            293. Ajustari pentru deprecierea imobilizarilor in curs de executie
                2931. Ajustari pentru deprecierea imobilizarilor corporale in curs de executie (P)
                2935. Ajustari pentru deprecierea investitiilor imobiliare in curs de executie (P)
            296. Ajustari pentru pierderea de valoare a imobilizarilor financiare
                2961. Ajustari pentru pierderea de valoare a actiunilor detinute la entitatile afiliate (P)
                2962. Ajustari pentru pierderea de valoare a actiunilor detinute la entitati asociate si entitati controlate in comun (P)
                2963. Ajustari pentru pierderea de valoare a altor titluri imobilizate (P)
                2964. Ajustari pentru pierderea de valoare a sumelor de incasat de la entitatile afiliate (P)
                2965. Ajustari pentru pierderea de valoare a creantelor fata de entitatile asociate si entitatile controlate in comun (P)
                2966. Ajustari pentru pierderea de valoare a imprumuturilor acordate pe termen lung (P)
                2968. Ajustari pentru pierderea de valoare a altor creante imobilizate (P)
    
    Clasa 3 - Conturi de stocuri si productie in curs de executie
        30. Stocuri de materii prime si materiale
            301. Materii prime (A)
            302. Materiale consumabile
                3021. Materiale auxiliare (A)
                3022. Combustibili (A)
                3023. Materiale pentru ambalat (A)
                3024. Piese de schimb (A)
                3025. Seminte si materiale de plantat (A)
                3026. Furaje (A)
                3028. Alte materiale consumabile (A)
            303. Materiale de natura obiectelor de inventar (A)
            308. Diferente de pret la materii prime si materiale (A/P)
        32. Stocuri in curs de aprovizionare
            321. Materii prime in curs de aprovizionare (A)
            322. Materiale consumabile in curs de aprovizionare (A)
            323. Materiale de natura obiectelor de inventar in curs de aprovizionare (A)
            326. Active biologice de natura stocurilor in curs de aprovizionare (A)
            327. Marfuri in curs de aprovizionare (A)
            328. Ambalaje in curs de aprovizionare (A)
        33. Productie in curs de executie
            331. Produse in curs de executie (A)
            332. Servicii in curs de executie (A)
        34. PRODUSE
            341. Semifabricate (A)
            345. Produse finite (A)
            346. Produse reziduale (A)
            347. Produse agricole (A)
            348. Diferente de pret la produse (A/P)
        35. STOCURI AFLATE LA TERTI
            351. Materii si materiale aflate la terti (A)
            354. Produse aflate la terti (A)
            356. Active biologice de natura stocurilor aflate la terti (A)
            357. Marfuri aflate la terti (A)
            358. Ambalaje aflate la terti (A)
        36. Active biologice de natura stocurilor
            361. Active biologice de natura stocurilor (A)
            368. Diferente de pret la active biologice de natura stocurilor (A/P)
        37. MARFURI
            371. Marfuri (A)
            378. Diferente de pret la marfuri (A/P)
        38. Ambalaje
            381. Ambalaje (A)
            388. Diferente de pret la ambalaje (A/P)
        39. Ajustari pentru deprecierea stocurilor si productiei in curs de executie
            391. Ajustari pentru deprecierea materiilor prime (P)
            392. Ajustari pentru deprecierea materialelor
                3921. Ajustari pentru deprecierea materialelor consumabile (P)
                3922. Ajustari pentru deprecierea materialelor de natura obiectelor de inventar (P)
            393. Ajustari pentru deprecierea productiei in curs de executie (P)
            394. Ajustari pentru deprecierea produselor
                3941. Ajustari pentru deprecierea semifabricatelor (P)
                3945. Ajustari pentru deprecierea produselor finite (P)
                3946. Ajustari pentru deprecierea produselor reziduale (P)
                3947. Ajustari pentru deprecierea produselor agricole (P)
            395. Ajustari pentru deprecierea stocurilor aflate la terti
                3951. Ajustari pentru deprecierea materiilor si materialelor aflate la terti (P)
                3952. Ajustari pentru deprecierea semifabricatelor aflate la terti (P)
                3953. Ajustari pentru deprecierea produselor finite aflate la terti (P)
                3954. Ajustari pentru deprecierea produselor reziduale aflate la terti (P)
                3955. Ajustari pentru deprecierea produselor agricole aflate la terti (P)
                3956. Ajustari pentru deprecierea activelor biologice de natura stocurilor aflate la terti (P)
                3957. Ajustari pentru deprecierea marfurilor aflate la terti (P)
                3958. Ajustari pentru deprecierea ambalajelor aflate la terti (P)
            396. Ajustari pentru deprecierea activelor biologice de natura stocurilor (P)
            397. Ajustari pentru deprecierea marfurilor (P)
            398. Ajustari pentru deprecierea ambalajelor (P)
    
    Clasa 4 - Conturi de terti
        40. Furnizori si conturi asimilate
            401. Furnizori (P)
            403. Efecte de platit (P)
            404. Furnizori de imobilizari (P)
            405. Efecte de platit pentru imobilizari (P)
            408. Furnizori - facturi nesosite (P)
            409. Furnizori - debitori
                4091. Furnizori - debitori pentru cumparari de bunuri de natura stocurilor (A)
                4092. Furnizori - debitori pentru prestari de servicii (A)
                4093. Avansuri acordate pentru imobilizari corporale (A)
                4094. Avansuri acordate pentru imobilizari necorporale (A)
        41. Clienti si conturi asimilate
            411. Clienti
                4111. Clienti (A)
                4118. Clienti incerti sau in litigiu (A)
            413. Efecte de primit de la clienti (A)
            418. Clienti - facturi de intocmit (A)
            419. Clienti - creditori (P)
        42. Personal si conturi asimilate
            421. Personal - salarii datorate (P)
            423. Personal - ajutoare materiale datorate (P)
            424. Prime reprezentand participarea personalului la profit (P)
            425. Avansuri acordate personalului (A)
            426. Drepturi de personal neridicate (P)
            427. Retineri din salarii datorate tertilor (P)
            428. Alte datorii si creante in legatura cu personalul
                4281. Alte datorii in legatura cu personalul (P)
                4282. Alte creante in legatura cu personalul (A)
        43. Asigurari sociale, protectia sociala si conturi asimilate
            431. Asigurari sociale
                4311. Contributia unitatii la asigurarile sociale (P)
                4312. Contributia personalului la asigurarile sociale (P)
                4313. Contributia angajatorului pentru asigurarile sociale de sanatate (P)
                4314. Contributia angajatilor pentru asigurarile sociale de sanatate (P)
                4315. Contributia de asigurari sociale (P)
                4316. Contributia de asigurari sociale de sanatate (P)
                4318. Alte contributii pentru asigurarile sociale de sanatate
            436. Contributia asiguratorie pentru munca (P)
            437. Ajutor de somaj
                4371. Contributia unitatii la fond  ul de somaj (P)
                4372. Contributia personalului la fondul de somaj (P)
            438. Alte datorii si creante sociale
                4381. Alte datorii sociale (P)
                4382. Alte creante sociale (A)
        44. Bugetul statului, fonduri speciale si conturi asimilate
            441. Impozitul pe profit si alte impozite
                4411. Impozitul pe profit (P)
                4415. Impozitul specific unor activitati (P)
                4417 Impozitul pe profit la nivelul impozitului minim pe cifra de afaceri
                4418. Impozitul pe venit (P)
            442. Taxa pe valoarea adaugata
                4423. TVA de plata (P)
                4424. TVA de recuperat (A)
                4426. TVA deductibila (A)
                4427. TVA colectata (P)
                4428. TVA neexigibila (A/P)
            444. Impozitul pe venituri de natura salariilor (P)
            445. Subventii
                4451. Subventii guvernamentale (A)
                4452. Imprumuturi nerambursabile cu caracter de subventii (A)
                4458. Alte sume primite cu caracter de subventii (A)
            446. Alte impozite, taxe si varsaminte asimilate (P)
            447. Fonduri speciale - taxe si varsaminte asimilate (P)
            448. Alte datorii si creante cu bugetul statului
                4481. Alte datorii fata de bugetul statului (P)
                4482. Alte creante privind bugetul statului (A)
        45. Grup si actionari/asociati
            451. Decontari intre entitatile afiliate
                4511. Decontari intre entitatile afiliate (A/P)
                4518. Dobanzi aferente decontarilor intre entitatile afiliate (A/P)
            453. Decontari cu entitatile asociate si entitatile controlate in comun
                4531. Decontari cu entitatile asociate si entitatile controlate
                4538. Dobanzi aferente decontarilor cu entitatile asociate si entitatile controlate in comun (A/P)
            455. Sume datorate actionarilor/asociatilor
                4551. Actionari/Asociati - conturi curente (P)
                4558. Actionari/Asociati - dobanzi la conturi curente (P)
            456. Decontari cu actionarii/asociatii privind capitalul (A/P)
            457. Dividende de plata (P)
            458. Decontari din operatiuni in participatie
                4581. Decontari din operatiuni in participatie - pasiv (P)
                4582. Decontari din operatiuni in participatie - activ (A)
        46. Debitori si creditori diversi
            461. Debitori diversi (A)
            462. Creditori diversi (P)
            463. Creante reprezentand dividende repartizate in cursul exercitiului financiar (A)
            466. Decontari din operatiuni de fiducie
                4661. Datorii din operatiuni de fiducie (P)
                4662. Creante din operatiuni de fiducie (A)
            467. Datorii aferente distribuirilor interimare de dividende   
        47. Conturi de subventii, regularizare si asimilate
            471. Cheltuieli inregistrate in avans (A)
            472. Venituri inregistrate in avans (P)
            473. Decontari din operatiuni in curs de clarificare (A/P)
            475. Subventii pentru investitii
                4751. Subventii guvernamentale pentru investitii (P)
                4752. Imprumuturi nerambursabile cu caracter de subventii pentru investitii (P)
                4753. Donatii pentru investitii (P)
                4754. Plusuri de inventar de natura imobilizarilor (P)
                4758. Alte sume primite cu caracter de subventii pentru investitii (P)
            478. Venituri in avans aferente activelor primite prin transfer de la clienti (P)
        48. Decontari in cadrul unitatii
            481. Decontari intre unitate si subunitati (A/P)
            482. Decontari intre subunitati (A/P)
        49. Ajustari pentru deprecierea creantelor
            490. Ajustari pentru deprecierea creantelor reprezentand avansuri acordate furnizorilor
                4901. Ajustari pentru deprecierea creantelor aferente cumpararilor de bunuri de natura stocurilor (P)
                4902. Ajustari pentru deprecierea creantelor aferente prestarilor de servicii (P)
                4903. Ajustari pentru deprecierea creantelor aferente imobilizarilor corporale (P)
                4904. Ajustari pentru deprecierea creantelor aferente imobilizarilor necorporale (P)
            491. Ajustari pentru deprecierea creantelor - clienti (P)
            495. Ajustari pentru deprecierea creantelor - decontari in cadrul grupului si cu actionarii/asociatii (P)
            496. Ajustari pentru deprecierea creantelor - debitori diversi (P)
    
    Clasa 5 - Conturi de trezorerie
        50. Investitii pe termen scurt
            501. Actiuni detinute la entitatile afiliate (A)
            505. Obligatiuni emise si rascumparate (A)
            506. Obligatiuni (A)
            507. Certificate verzi primite (A)
            508. Alte investitii pe termen scurt si creante asimilate
                5081. Alte titluri de plasament (A)
                5088. Dobanzi la obligatiuni si titluri de plasament (A)
            509. Varsaminte de efectuat pentru investitiile pe termen scurt
                5091. Varsaminte de efectuat pentru actiunile detinute la entitatile afiliate (P)
                5092. Varsaminte de efectuat pentru alte investitii pe termen scurt (P)
        51. Conturi la banci
            511. Valori de incasat
                5112. Cecuri de incasat (A)
                5113. Efecte de incasat (A)
                5114. Efecte remise spre scontare (A)
            512. Conturi curente la banci
                5121. Conturi la banci in lei (A)
                5124. Conturi la banci in valuta (A)
                5125. Sume in curs de decontare (A)
            518. Dobanzi
                5186. Dobanzi de platit (P)
                5187. Dobanzi de incasat (A)
            519. Credite bancare pe termen scurt
                5191. Credite bancare pe termen scurt (P)
                5192. Credite bancare pe termen scurt nerambursate la scadenta (P)
                5193. Credite externe guvernamentale (P)
                5194. Credite externe garantate de stat (P)
                5195. Credite externe garantate de banci (P)
                5196. Credite de la Trezoreria Statului (P)
                5197. Credite interne garantate de stat (P)
                5198. Dobanzi aferente creditelor bancare pe termen scurt (P)
        53. Casa
            531. Casa
                5311. Casa in lei (A)
                5314. Casa in valuta (A)
            532. Alte valori
                5321. Timbre fiscale si postale (A)
                5322. Bilete de tratament si odihna (A)
                5323. Tichete si bilete de calatorie (A)
                5328. Alte valori (A)
        54. Acreditive
            541. Acreditive
                5411. Acreditive in lei (A)
                5414. Acreditive in valuta (A)
            542. Avansuri de trezorerie (A)
        58. Viramente interne
            581. Viramente interne (A/P)
        59. Ajustari pentru pierderea de valoare a conturilor de trezorerie
            591. Ajustari pentru pierderea de valoare a actiunilor detinute la entitatile afiliate (P)
            595. Ajustari pentru pierderea de valoare a obligatiunilor emise si rascumparate (P)
            596. Ajustari pentru pierderea de valoare a obligatiunilor (P)
            598. Ajustari pentru pierderea de valoare a altor investitii pe termen scurt si creante asimilate (P)
    
    Clasa 6 - Conturi de cheltuieli
        60. Cheltuieli privind stocurile si alte consumuri
            601. Cheltuieli cu materiile prime
            602. Cheltuieli cu materialele consumabile
                6021. Cheltuieli cu materialele auxiliare
                6022. Cheltuieli privind combustibilii
                6023. Cheltuieli privind materialele pentru ambalat
                6024. Cheltuieli privind piesele de schimb
                6025. Cheltuieli privind semintele si materialele de plantat
                6026. Cheltuieli privind furajele
                6028. Cheltuieli privind alte materiale consumabile
            603. Cheltuieli privind materialele de natura obiectelor de inventar
            604. Cheltuieli privind materialele nestocate
            605. Cheltuieli privind utilitatile 
                6051. Cheltuieli privind consumul de energie
                6052. Cheltuieli privind consumul de apa
                6053 Cheltuieli privind consumul de gaze naturale
                6058 Cheltuieli cu alte utilitati
            606. Cheltuieli privind activele biologice de natura stocurilor
            607. Cheltuieli privind marfurile
            608. Cheltuieli privind ambalajele
            609. Reduceri comerciale primite
        61. Cheltuieli cu serviciile executate de terti
            611. Cheltuieli cu intretinerea si reparatiile
            612. Cheltuieli cu redeventele, locatiile de gestiune si chiriile
                6121 „Cheltuieli cu redeventele
                6122 Cheltuieli cu locatiile de gestiune
                6123 Cheltuieli cu chiriile
            613. Cheltuieli cu primele de asigurare
            614. Cheltuieli cu studiile si cercetarile
            615. Cheltuieli cu pregatirea personalului
            616 Cheltuieli aferente drepturilor de proprietate intelectuală”
            617 Cheltuieli de management 
            618 Cheltuieli de consultanta
        62. Cheltuieli cu alte servicii executate de terti
            621. Cheltuieli cu colaboratorii
            622. Cheltuieli privind comisioanele si onorariile
            623. Cheltuieli de protocol, reclama si publicitate
                6231. Cheltuieli de protocol
                6232. Cheltuieli de reclama si publicitate
            624. Cheltuieli cu transportul de bunuri si personal
            625. Cheltuieli cu deplasari, detasari si transferari
            626. Cheltuieli postale si taxe de telecomunicatii
            627. Cheltuieli cu serviciile bancare si asimilate
            628. Alte cheltuieli cu serviciile executate de terti
        63. Cheltuieli cu alte impozite, taxe si varsaminte asimilate
            635. Cheltuieli cu alte impozite, taxe si varsaminte asimilate
                6351. Cheltuieli cu impozitul suplimentar pentru sectoarele de activitate specifice
        64. Cheltuieli cu personalul
            641. Cheltuieli cu salariile personalului
            642. Cheltuieli cu avantajele in natura si tichetele acordate salariatilor
                6421. Cheltuieli cu avantajele in natura acordate salariatilor
                6422. Cheltuieli cu tichetele acordate salariatilor
            643. Cheltuieli cu remunerarea in instrumente de capitaluri proprii
            644. Cheltuieli cu primele reprezentand participarea personalului la profit
            645. Cheltuieli privind asigurarile si protectia sociala
                6451. Cheltuieli privind contributia unitatii la asigurarile sociale
                6452. Cheltuieli privind contributia unitatii pentru ajutorul de somaj
                6453. Cheltuieli privind contributia angajatorului pentru asigurarile sociale de sanatate
                6455. Cheltuieli privind contributia unitatii la asigurarile de viata
                6456. Cheltuieli privind contributia unitatii la fondurile de pensii facultative
                6457. Cheltuieli privind contributia unitatii la primele de asigurare voluntara de sanatate
                6458. Alte cheltuieli privind asigurarile si protectia sociala
            646. Cheltuieli privind contributia asiguratorie pentru munca
                6461. Cheltuieli privind contributia asiguratorie pentru munca corespunzatoare salariatilor
                6462. Cheltuieli privind contributia asiguratorie pentru munca corespunzatoare altor persoane, decat salariatii
        65. Alte cheltuieli de exploatare
            651. Cheltuieli din operatiuni de fiducie
                6511. Cheltuieli ocazionate de constituirea fiduciei
                6512. Cheltuieli din derularea operatiunilor de fiducie
                6513. Cheltuieli din lichidarea operatiunilor de fiducie
            652. Cheltuieli cu protectia mediului inconjurator
            654. Pierderi din creante si debitori diversi
            655. Cheltuieli din reevaluarea imobilizarilor corporale
            658. Alte cheltuieli de exploatare
                6581. Despagubiri, amenzi si penalitati
                6582. Donatii acordate
                6583. Cheltuieli privind activele cedate si alte operatiuni de capital
                6584. Cheltuieli cu sumele sau bunurile acordate ca sponsorizari
                6586. Cheltuieli reprezentand transferuri si contributii datorate in baza unor acte normative speciale
                6587. Cheltuieli privind calamitatile si alte evenimente similare
                6588. Alte cheltuieli de exploatare
        66. Cheltuieli financiare
            663. Pierderi din creante legate de participatii
            664. Cheltuieli privind investitiile financiare cedate
                6641. Cheltuieli privind imobilizarile financiare cedate
                6642. Pierderi din investitiile pe termen scurt cedate
            665. Cheltuieli din diferente de curs valutar
                6651. Diferente nefavorabile de curs valutar legate de elementele monetare exprimate in valuta
                6652. Diferente nefavorabile de curs valutar din evaluarea elementelor monetare care fac parte din investitia neta intr-o entitate straina
            666. Cheltuieli privind dobanzile
            667. Cheltuieli privind sconturile acordate
            668. Alte cheltuieli financiare
        68. Cheltuieli cu amortizarile, provizioanele si ajustarile pentru depreciere sau pierdere de valoare
            681. Cheltuieli de exploatare privind amortizarile, provizioanele si ajustarile pentru depreciere
                6811. Cheltuieli de exploatare privind amortizarea imobilizarilor
                6812. Cheltuieli de exploatare privind provizioanele
                6813. Cheltuieli de exploatare privind ajustarile pentru deprecierea imobilizarilor
                6814. Cheltuieli de exploatare privind ajustarile pentru deprecierea activelor circulante
                6817. Cheltuieli de exploatare privind ajustarile pentru deprecierea fondului comercial
                6818. Cheltuieli de exploatare privind ajustarile pentru deprecierea creantelor reprezentand avansuri acordate furnizorilor
            686. Cheltuieli financiare privind amortizarile, provizioanele si ajustarile pentru pierdere de valoare
                6861. Cheltuieli privind actualizarea provizioanelor
                6863. Cheltuieli financiare privind ajustarile pentru pierderea de valoare a imobilizarilor financiare
                6864. Cheltuieli financiare privind ajustarile pentru pierderea de valoare a activelor circulante
                6865. Cheltuieli financiare privind amortizarea diferentelor aferente titlurilor de stat
                6868. Cheltuieli financiare privind amortizarea primelor de rambursare a obligatiunilor si a altor datorii
        69. Cheltuieli cu impozitul pe profit si alte impozite
            691. Cheltuieli cu impozitul pe profit
            694. Cheltuieli cu impozitul pe profit rezultat din decontarile in cadrul grupului fiscal in domeniul impozitului pe profit
            695. Cheltuieli cu impozitul specific unor activitati
            697. Cheltuieli cu impozitul pe profit la nivelul impozitului minim pe cifra de afaceri
            698. Cheltuieli cu impozitul pe venit si cu alte impozite care nu apar in elementele de mai sus
    
    Clasa 7 - Conturi de venituri
        70. Cifra de afaceri neta
            701. Venituri din vanzarea produselor finite, produselor agricole si a activelor biologice de natura stocurilor
                7015. Venituri din vanzarea produselor finite
                7017. Venituri din vanzarea produselor agricole
                7018. Venituri din vanzarea activelor biologice de natura stocurilor
            702. Venituri din vanzarea semifabricatelor
            703. Venituri din vanzarea produselor reziduale
            704. Venituri din servicii prestate
            705. Venituri din studii si cercetari
            706. Venituri din redevente, locatii de gestiune si chirii
            707. Venituri din vanzarea marfurilor
            708. Venituri din activitati diverse
            709. Reduceri comerciale acordate
        71. Venituri aferente costului productiei in curs de executie
            711. Venituri aferente costurilor stocurilor de produse
            712. Venituri aferente costurilor serviciilor in curs de executie
        72. Venituri din productia de imobilizari
            721. Venituri din productia de imobilizari necorporale
            722. Venituri din productia de imobilizari corporale
            725. Venituri din productia de investitii imobiliare
        74. Venituri din subventii de exploatare
            741. Venituri din subventii de exploatare
                7411. Venituri din subventii de exploatare aferente cifrei de afaceri*22)
                7412. Venituri din subventii de exploatare pentru materii prime si materiale
                7413. Venituri din subventii de exploatare pentru alte cheltuieli externe
                7414. Venituri din subventii de exploatare pentru plata personalului
                7415. Venituri din subventii de exploatare pentru asigurari si protectie sociala
                7416. Venituri din subventii de exploatare pentru alte cheltuieli de exploatare
                7417. Venituri din subventii de exploatare in caz de calamitati si alte evenimente similare
                7418. Venituri din subventii de exploatare pentru dobanda datorata
                7419. Venituri din subventii de exploatare aferente altor venituri
        75. Alte venituri din exploatare
            751. Venituri din operatiuni de fiducie
                7511. Venituri ocazionate de constituirea fiduciei
                7512. Venituri din derularea operatiunilor de fiducie
                7513. Venituri din lichidarea operatiunilor de fiducie
            754. Venituri din creante reactivate si debitori diversi
            755. Venituri din reevaluarea imobilizarilor corporale
            758. Alte venituri din exploatare
                7581. Venituri din despagubiri, amenzi si penalitati
                7582. Venituri din donatii primite
                7583. Venituri din vanzarea activelor si alte operatiuni de capital
                7584. Venituri din subventii pentru investitii
                7586. Venituri reprezentand transferuri cuvenite in baza unor acte normative speciale
                7588. Alte venituri din exploatare
        76. Venituri financiare
            761. Venituri din imobilizari financiare
                7611. Venituri din actiuni detinute la entitatile afiliate
                7612. Venituri din actiuni detinute la entitati asociate
                7613. Venituri din actiuni detinute la entitati controlate in comun
                7615. Venituri din alte imobilizari financiare
            762. Venituri din investitii financiare pe termen scurt
            764. Venituri din investitii financiare cedate
                7641. Venituri din imobilizari financiare cedate
                7642. Castiguri din investitii pe termen scurt cedate
            765. Venituri din diferente de curs valutar
                7651. Diferente favorabile de curs valutar legate de elementele monetare exprimate in valuta
                7652. Diferente favorabile de curs valutar din evaluarea elementelor monetare care fac parte din investitia neta intr-o entitate straina
            766. Venituri din dobanzi
            767. Venituri din sconturi obtinute
            768. Alte venituri financiare
        78. Venituri din provizioane, amortizari si ajustari pentru depreciere sau pierdere de valoare
            781. Venituri din provizioane si ajustari pentru depreciere privind activitatea de exploatare
                7812. Venituri din provizioane
                7813. Venituri din ajustari pentru deprecierea imobilizarilor
                7814. Venituri din ajustari pentru deprecierea activelor circulante
                7815. Venituri din fondul comercial negativ
                7818. Venituri din ajustari pentru deprecierea creantelor reprezentand avansuri acordate furnizorilor
            786. Venituri financiare din amortizari si ajustari pentru pierdere de valoare
                7863. Venituri financiare din ajustari pentru pierderea de valoare a imobilizarilor financiare
                7864. Venituri financiare din ajustari pentru pierderea de valoare a activelor circulante
                7865. Venituri financiare din amortizarea diferentelor aferente titlurilor de stat
        79. Venituri din impozitul pe profit
            794. Venituri din impozitul pe profit rezultat din decontarile in cadrul grupului fiscal in domeniul impozitului pe profit
    
    Clasa 8 - conturi speciale
        80. Conturi in afara bilantului
            801. Angajamente acordate
                8011. Giruri si garantii acordate
                8018. Alte angajamente acordate
            802. Angajamente primite
                8021. Giruri si garantii primite
                8028. Alte angajamente primite
            803. Alte conturi in afara bilantului
                8031. Imobilizari corporale primite cu chirie sau in baza altor contracte similare
                8032. Valori materiale primite spre prelucrare sau reparare
                8033. Valori materiale primite in pastrare sau custodie
                8034. Debitori scosi din activ, urmariti in continuare
                8035. Stocuri de natura obiectelor de inventar date in folosinta
                8036. Redevente, locatii de gestiune, chirii si alte datorii asimilate
                8037. Efecte scontate neajunse la scadenta
                8038. Bunuri primite in administrare, concesiune, cu chirie si alte bunuri similare
                8039. Alte valori in afara bilantului
            804. Certificate verzi
            805. Dobanzi aferente contractelor de leasing si altor contracte asimilate, neajunse la scadenta
                8051. Dobanzi de platit
                8052. Dobanzi de incasat
            806. Certificate de emisii de gaze cu efect de sera
            807. Active contingente
            808. Datorii contingente
            809. Creante preluate prin cesionare
        89. Bilant
            891. Bilant de deschidere
            892. Bilant de inchidere
    
    Clasa 9 - conturi de gestiune
        90. Decontari interne
            901. Decontari interne privind cheltuielile
            902. Decontari interne privind productia obtinuta
            903. Decontari interne privind diferentele de pret
        92. Conturi de calculatie
            921. Cheltuielile activitatii de baza
            922. Cheltuielile activitatilor auxiliare
            923. Cheltuieli indirecte de productie
            924. Cheltuieli generale de administratie
            925. Cheltuieli de desfacere
        93. Costul productiei
            931. Costul productiei obtinute
            933. Costul productiei in curs de executie
    """

def validate_processed_data(data: dict, expected_doc_type: str = None) -> tuple[bool, list[str]]:
    """Validate that processed data contains minimum required fields."""
    errors = []
    
    if not data or not isinstance(data, dict):
        errors.append("Invalid data structure")
        return False, errors
    
    if not data.get('document_type'):
        errors.append("Missing document_type")
        return False, errors
    
    # Enhanced validation for invoices to prevent empty responses
    if data.get('document_type', '').lower() == 'invoice':
        # Check for critical invoice fields
        critical_fields = ['vendor', 'buyer', 'total_amount', 'document_date']
        missing_critical = [field for field in critical_fields if not data.get(field)]
        
        if missing_critical:
            print(f"WARNING: Missing critical invoice fields: {missing_critical}", file=sys.stderr)
            # Don't fail validation for missing fields, just warn
            errors.append(f"Missing critical fields: {', '.join(missing_critical)}")
        
        # Ensure line_items is always an array, even if empty
        if 'line_items' not in data:
            data['line_items'] = []
            print("WARNING: No line_items found, setting empty array", file=sys.stderr)
        elif not isinstance(data.get('line_items'), list):
            data['line_items'] = []
            print("WARNING: line_items is not an array, setting empty array", file=sys.stderr)
    
    return True, errors

def create_fallback_response(doc_type: str = "Unknown") -> dict:
    """Create a minimal fallback response when processing fails."""
    return {
        "document_type": doc_type,
        "document_date": "",
        "vendor": "",
        "buyer": "",
        "total_amount": 0,
        "vat_amount": 0,
        "currency": "RON",
        "line_items": [] if doc_type.lower() == 'invoice' else None,
        "transactions": [] if doc_type.lower() == 'bank statement' else None,
        "duplicate_detection": {
            "is_duplicate": False,
            "duplicate_matches": [],
            "document_hash": "",
            "confidence": 0.0
        },
        "compliance_validation": {
            "compliance_status": "PENDING",
            "overall_score": 0.0,
            "validation_rules": {"ro": [], "en": []},
            "errors": {"ro": ["Procesare incompletă - verificați manual"], "en": ["Incomplete processing - please verify manually"]},
            "warnings": {"ro": [], "en": []}
        },
        "confidence": 0.1,
        "processing_status": "FALLBACK"
    }

def test_openai_connection():
    """Test direct OpenAI connection to verify API key."""
    try:
        import openai
        api_key = os.getenv('OPENAI_API_KEY')
        
        if not api_key:
            print("ERROR: No OpenAI API key found in test_openai_connection", file=sys.stderr)
            return False
            
        print(f"Testing OpenAI API key (length: {len(api_key)}, prefix: {api_key[:10]}...)", file=sys.stderr)
        
        client = openai.OpenAI(api_key=api_key)
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Say 'API key works'"}],
            max_tokens=10,
            timeout=30
        )
        
        print(f"OpenAI API test successful: {response.choices[0].message.content}", file=sys.stderr)
        return True
    except Exception as e:
        print(f"ERROR: OpenAI API test failed: {str(e)}", file=sys.stderr)
        print(f"Error type: {type(e).__name__}", file=sys.stderr)
        return False

def check_llm_configuration():
    """Check if LLM is properly configured"""
    openai_api_key = os.getenv('OPENAI_API_KEY')
    anthropic_api_key = os.getenv('ANTHROPIC_API_KEY')
    
    if not openai_api_key and not anthropic_api_key:
        print("ERROR: No LLM API key found. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.", file=sys.stderr)
        return False
    
    if openai_api_key:
        print("OpenAI API key found - using OpenAI models", file=sys.stderr)
        if test_openai_connection():
            print("OpenAI API key verified and working", file=sys.stderr)
            return True
        else:
            print("ERROR: OpenAI API key validation failed", file=sys.stderr)
            return False
    elif anthropic_api_key:
        print("Anthropic API key found - using Claude models", file=sys.stderr)
        return True
    
    return False

def setup_memory_monitoring():
    """Setup memory monitoring if available."""
    try:
        tracemalloc.start()
        return True
    except Exception:
        return False

def log_memory_usage(label: str):
    """Log current memory usage."""
    try:
        import psutil
        process = psutil.Process(os.getpid())
        memory_info = process.memory_info()
        print(f"{label} - Memory: RSS={memory_info.rss // 1024 // 1024}MB, VMS={memory_info.vms // 1024 // 1024}MB", file=sys.stderr)
        
        if tracemalloc.is_tracing():
            current, peak = tracemalloc.get_traced_memory()
            print(f"{label} - Traced: Current={current // 1024 // 1024}MB, Peak={peak // 1024 // 1024}MB", file=sys.stderr)
    except ImportError:
        pass
    except Exception as e:
        print(f"Memory logging failed: {e}", file=sys.stderr)

def cleanup_memory():
    """Force garbage collection and cleanup."""
    try:
        collected = gc.collect()
        print(f"Garbage collected {collected} objects", file=sys.stderr)
        
        if tracemalloc.is_tracing():
            tracemalloc.clear_traces()
            
    except Exception as e:
        print(f"Memory cleanup failed: {e}", file=sys.stderr)

def get_existing_articles() -> Dict:
    """Load existing articles with error handling and memory optimization."""
    articles = {}
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        articles_path = os.path.join(script_dir, "articles.csv")
        
        if not os.path.exists(articles_path):
            articles_path = "articles.csv"
        
        if not os.path.exists(articles_path):
            print("WARNING: articles.csv not found, using empty articles", file=sys.stderr)
            return {}
            
        with open(articles_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                articles[row["code"]] = {
                    "name": row["name"],
                    "vat": row["vat"],
                    "unitOfMeasure": row["unitOfMeasure"],
                    "type": row["type"]
                }
                
        print(f"Loaded {len(articles)} articles", file=sys.stderr)
        
    except Exception as e:
        print(f"ERROR: Error reading articles.csv: {str(e)}", file=sys.stderr)
        return {}
    
    return articles

def generate_document_hash(file_path: str) -> str:
    """Generate MD5 hash of document content."""
    try:
        with open(file_path, 'rb') as f:
            content = f.read()
            return hashlib.md5(content).hexdigest()
    except Exception as e:
        print(f"Failed to generate document hash: {str(e)}", file=sys.stderr)
        return ""

def load_user_corrections(client_company_ein: str) -> List[Dict]:
    """Load user corrections for learning (mock implementation - replace with actual DB call)."""
    return []

def save_temp_file(base64_data: str) -> str:
    """Save base64 data to a temporary file with error handling."""
    try:
        if not base64_data:
            raise ValueError("Empty base64 data")
            
        estimated_size = len(base64_data) * 3 // 4
        max_size = 50 * 1024 * 1024
        
        if estimated_size > max_size:
            raise ValueError(f"File too large: {estimated_size // 1024 // 1024}MB > {max_size // 1024 // 1024}MB")
        
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.pdf', delete=False) as temp_file:
            chunk_size = 1024 * 1024 
            for i in range(0, len(base64_data), chunk_size):
                chunk = base64_data[i:i + chunk_size]
                decoded_chunk = base64.b64decode(chunk)
                temp_file.write(decoded_chunk)
                
            temp_path = temp_file.name
            
        print(f"Saved temporary file: {temp_path} ({estimated_size // 1024}KB)", file=sys.stderr)
        return temp_path
        
    except Exception as e:
        print(f"ERROR: Error saving temporary file: {str(e)}", file=sys.stderr)
        raise

def validate_compliance_output(result):
    """Validate and fix compliance data to ensure bilingual structure"""
    if not result or not isinstance(result, dict):
        return False
    
    compliance_data = result.get('compliance_validation')
    if not compliance_data:
        return True 
    
    if not isinstance(compliance_data, dict):
        return False
    
    if 'compliance_status' not in compliance_data:
        return False
    
    bilingual_fields = ['validation_rules', 'errors', 'warnings']
    
    for field in bilingual_fields:
        field_data = compliance_data.get(field)
        
        if field_data is None:
            compliance_data[field] = {'ro': [], 'en': []}
        elif isinstance(field_data, list):
            compliance_data[field] = {'ro': field_data, 'en': field_data}
            print(f"Converted legacy {field} format to bilingual", file=sys.stderr)
        elif isinstance(field_data, dict):
            if 'ro' not in field_data or 'en' not in field_data:
                ro_data = field_data.get('ro', [])
                en_data = field_data.get('en', [])
                compliance_data[field] = {
                    'ro': ro_data if isinstance(ro_data, list) else [],
                    'en': en_data if isinstance(en_data, list) else []
                }
                print(f"Fixed incomplete bilingual structure for {field}", file=sys.stderr)
        else:
            compliance_data[field] = {'ro': [], 'en': []}
            print(f"Reset invalid {field} format to empty bilingual structure", file=sys.stderr)
    
    if 'overall_score' in compliance_data:
        try:
            compliance_data['overall_score'] = float(compliance_data['overall_score'])
        except (ValueError, TypeError):
            print("Fixed invalid overall_score format", file=sys.stderr)
            compliance_data['overall_score'] = 0.0
    
    return True

def extract_json_from_text(text: str) -> dict:
    """Extract JSON from text with optimized parsing and compliance validation."""
    if not text:
        print("⚠️  WARNING: extract_json_from_text received empty text", file=sys.stderr)
        return {}
    
    import re
    
    print(f"🔍 extract_json_from_text input (first 500 chars): {text[:500]}", file=sys.stderr)
    
    text = re.sub(r'\x1b\[[0-9;]*m', '', text) 
    text = text.strip()
    
    # First try direct JSON parsing
    try:
        result = json.loads(text)
        print(f"✅ Successfully parsed JSON directly. Keys: {list(result.keys())}", file=sys.stderr)
        
        # Validate that we have meaningful data for invoices
        if result.get('document_type', '').lower() == 'invoice':
            if not result.get('vendor') and not result.get('buyer') and not result.get('total_amount'):
                print(f"⚠️  WARNING: Invoice JSON lacks critical fields (vendor, buyer, total_amount)", file=sys.stderr)
            else:
                print(f"✅ Invoice JSON contains critical fields", file=sys.stderr)
        
        if 'compliance_validation' in result:
            if not validate_compliance_output(result):
                print("WARNING: Invalid compliance validation format, attempting to fix...", file=sys.stderr)
                validate_compliance_output(result)
        return result
    except json.JSONDecodeError as e:
        print(f"❌ Direct JSON parsing failed: {e}", file=sys.stderr)
        pass
    
    def find_json_objects(text):
        results = []
        brace_count = 0
        start_idx = -1
        
        for i, char in enumerate(text):
            if char == '{':
                if brace_count == 0:
                    start_idx = i
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0 and start_idx != -1:
                    try:
                        json_str = text[start_idx:i+1]
                        json_obj = json.loads(json_str)
                        results.append(json_obj)
                        print(f"Found JSON object with keys: {list(json_obj.keys())}", file=sys.stderr)
                        if len(results) >= 5:
                            break
                    except json.JSONDecodeError:
                        pass
                    start_idx = -1
        
        return results
    
    json_objects = find_json_objects(text)
    
    if json_objects:
        json_objects.sort(key=lambda x: len(x.keys()), reverse=True)
        result = json_objects[0]
        print(f"Using largest JSON object found. Keys: {list(result.keys())}", file=sys.stderr)
        if 'compliance_validation' in result:
            if not validate_compliance_output(result):
                print("WARNING: Invalid compliance validation format, attempting to fix...", file=sys.stderr)
                validate_compliance_output(result)
        return result
    
    json_in_code = re.search(r'```(?:json)?\s*(\{[^`]+\})\s*```', text, re.DOTALL)
    if json_in_code:
        try:
            result = json.loads(json_in_code.group(1))
            print(f"Extracted JSON from code block. Keys: {list(result.keys())}", file=sys.stderr)
            if 'compliance_validation' in result:
                if not validate_compliance_output(result):
                    print("WARNING: Invalid compliance validation format, attempting to fix...", file=sys.stderr)
                    validate_compliance_output(result)
            return result
        except json.JSONDecodeError:
            pass
    
    if any(keyword in text.lower() for keyword in ["document_type", "vendor", "buyer", "company", "compliance_validation", "document_number", "document_date", "total_amount"]):
        result = {}
        patterns = [
            (r'"document_type"\s*:\s*"([^"]+)"', 'document_type'),
            (r'"direction"\s*:\s*"([^"]+)"', 'direction'),
            (r'"document_number"\s*:\s*"([^"]+)"', 'document_number'),
            (r'"document_date"\s*:\s*"([^"]+)"', 'document_date'),
            (r'"vendor"\s*:\s*"([^"]+)"', 'vendor'),
            (r'"vendor_ein"\s*:\s*"([^"]+)"', 'vendor_ein'),
            (r'"buyer"\s*:\s*"([^"]+)"', 'buyer'),
            (r'"buyer_ein"\s*:\s*"([^"]+)"', 'buyer_ein'),
            (r'"total_amount"\s*:\s*([\d.]+)', 'total_amount'),
            (r'"vat_amount"\s*:\s*([\d.]+)', 'vat_amount'),
            (r'"currency"\s*:\s*"([^"]+)"', 'currency'),
            (r'"company_name"\s*:\s*"([^"]+)"', 'company_name'),
            (r'"company_ein"\s*:\s*"([^"]+)"', 'company_ein'),
        ]
        
        for pattern, key in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                value = match.group(1)
                if key in ['total_amount', 'vat_amount']:
                    try:
                        result[key] = float(value)
                    except ValueError:
                        result[key] = value
                else:
                    result[key] = value
        
        line_items_match = re.search(r'"line_items"\s*:\s*\[(.*?)\]', text, re.DOTALL | re.IGNORECASE)
        if line_items_match:
            try:
                line_items_str = '[' + line_items_match.group(1) + ']'
                result['line_items'] = json.loads(line_items_str)
                print(f"Extracted {len(result['line_items'])} line items", file=sys.stderr)
            except:
                result['line_items'] = []
        
        if 'compliance_validation' in text.lower():
            status_match = re.search(r'"compliance_status"\s*:\s*"([^"]+)"', text, re.IGNORECASE)
            if status_match:
                result['compliance_validation'] = {
                    'compliance_status': status_match.group(1),
                    'overall_score': 0.0,
                    'validation_rules': {'ro': [], 'en': []},
                    'errors': {'ro': [], 'en': []},
                    'warnings': {'ro': [], 'en': []}
                }
                print("Extracted basic compliance validation structure from patterns", file=sys.stderr)
        
        if result:
            print(f"Extracted structured data using patterns: {list(result.keys())}", file=sys.stderr)
            if 'compliance_validation' in result:
                if not validate_compliance_output(result):
                    print("WARNING: Invalid compliance validation format, attempting to fix...", file=sys.stderr)
                    validate_compliance_output(result)
            return result
    
    print(f"WARNING: Could not extract JSON from text (length: {len(text)})", file=sys.stderr)
    print(f"Text contains 'document_number': {'document_number' in text}", file=sys.stderr)
    print(f"Text contains 'document_date': {'document_date' in text}", file=sys.stderr)
    print(f"Text contains 'vendor': {'vendor' in text}", file=sys.stderr)
    print(f"Last 500 chars of text: {text[-500:]}", file=sys.stderr)
    
    return {}

def process_with_retry(crew_instance, inputs: dict, max_retries: int = 2) -> tuple[dict, bool]:
    """Process document with retry logic and validation."""
    for attempt in range(max_retries + 1):
        try:
            print(f"Processing attempt {attempt + 1}/{max_retries + 1}", file=sys.stderr)
            
            captured_output = StringIO()
            
            with redirect_stdout(captured_output), redirect_stderr(captured_output):
                if crew_instance.processing_phase == 1:
                    doc_type = None

                    phase0_data = inputs.get('phase0_data')
                    if phase0_data:
                        try:
                            if isinstance(phase0_data, str):
                                import json
                                phase0_parsed = json.loads(phase0_data)
                                doc_type = phase0_parsed.get('document_type', '').lower()
                                print(f"Parsed phase0_data from string: {phase0_parsed}", file=sys.stderr)
                            elif isinstance(phase0_data, dict):
                                doc_type = phase0_data.get('document_type', '').lower()
                                print(f"Using phase0_data dict: {phase0_data}", file=sys.stderr)
                        except Exception as e:
                            print(f"Error parsing phase0_data: {e}", file=sys.stderr)
    
                    if not doc_type:
                        doc_type = inputs.get('doc_type', '').lower()
    
                    if not doc_type:
                        doc_type = 'unknown'
    
                    print(f"Phase 1: Processing {doc_type} document", file=sys.stderr)

                    crew_obj = crew_instance.crew()

                    if doc_type == 'invoice':
                        extraction_task = crew_instance.extract_invoice_data_task()
                        print("Using invoice extraction task", file=sys.stderr)
                    else:
                        extraction_task = crew_instance.extract_other_document_data_task()
                        print(f"Using other document extraction task for {doc_type}", file=sys.stderr)

                    crew_obj.tasks.insert(0, extraction_task)

                    result = crew_obj.kickoff(inputs=inputs)
                else:
                    result = crew_instance.crew().kickoff(inputs=inputs)
            
            combined_data = {
                "document_type": "Unknown",
                "line_items": [],
                "document_hash": inputs.get("document_hash", ""),
                "duplicate_detection": {"is_duplicate": False, "duplicate_matches": []},
                "compliance_validation": {"compliance_status": "PENDING", "validation_rules": {"ro": [], "en": []}, "errors": {"ro": [], "en": []}, "warnings": {"ro": [], "en": []}}
            }
            
            if hasattr(result, 'tasks_output') and result.tasks_output:
                print(f"Processing {len(result.tasks_output)} task outputs", file=sys.stderr)

                current_phase = inputs.get('processing_phase', crew_instance.processing_phase)
                print(f"Current processing phase: {current_phase}", file=sys.stderr)

                for i, task_output in enumerate(result.tasks_output):
                    try:
                        if task_output and hasattr(task_output, 'raw') and task_output.raw:
                            output_length = len(task_output.raw)
                            print(f"Task {i} output length: {output_length}", file=sys.stderr)
                            print(f"🐍 DEBUG Task {i} first 200 chars: {task_output.raw[:200]}", file=sys.stderr)

                            if current_phase == 0:

                                if i == 0: 
                                    categorization_data = extract_json_from_text(task_output.raw)
                                    if categorization_data and isinstance(categorization_data, dict):
                                        combined_data.update(categorization_data)
                                        doc_type = categorization_data.get('document_type', 'Unknown')
                                        print(f"Document categorized as: {doc_type}", file=sys.stderr)
                                        inputs['doc_type'] = doc_type
                                    else:
                                        print(f"🐍 DEBUG: Task 0 extraction failed or empty", file=sys.stderr)

                            elif current_phase == 1:
                                if i == 0:
                                    expected_doc_type = inputs.get('phase0_data', {}).get('document_type', inputs.get('doc_type', ''))

                                    print(f"🐍 DEBUG: Processing Task {i} (Data extraction for {expected_doc_type})", file=sys.stderr)
                                    print(f"🐍 DEBUG: Task {i} raw output: {task_output.raw}", file=sys.stderr)

                                    extraction_data = extract_json_from_text(task_output.raw)
                                    print(f"🐍 DEBUG: Task {i} extracted data: {extraction_data}", file=sys.stderr)

                                    if extraction_data and isinstance(extraction_data, dict):
                                        print(f"🐍 DEBUG: Task {i} extracted keys: {list(extraction_data.keys())}", file=sys.stderr)

                                        if not extraction_data.get('document_type') or extraction_data.get('document_type') == 'Unknown':
                                            if expected_doc_type and expected_doc_type.lower() != 'unknown':
                                                extraction_data['document_type'] = standardize_document_type(expected_doc_type)
                                                print(f"🐍 DEBUG: Preserved document_type from phase 0: {extraction_data['document_type']}", file=sys.stderr)
                                        
                                        # Check if AI returned meaningful data
                                        if expected_doc_type and expected_doc_type.lower() == 'invoice':
                                            has_critical_data = (
                                                extraction_data.get('vendor') or 
                                                extraction_data.get('buyer') or 
                                                extraction_data.get('total_amount') or
                                                (extraction_data.get('line_items') and len(extraction_data.get('line_items', [])) > 0)
                                            )
                                            if not has_critical_data:
                                                print(f"🚨 CRITICAL: AI extraction returned EMPTY data for invoice!", file=sys.stderr)
                                                print(f"🚨 FORCING AI to retry with enhanced prompting...", file=sys.stderr)
                                                
                                                # Force AI to retry with better prompting
                                                try:
                                                    from openai import OpenAI
                                                    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
                                                    
                                                    # Get document text for retry
                                                    from .tools.simple_text_extractor import SimpleTextExtractorTool
                                                    text_extractor = SimpleTextExtractorTool()
                                                    doc_text = text_extractor._run(inputs.get('document_path', ''))
                                                    
                                                    if doc_text and len(doc_text.strip()) > 100:
                                                        print(f"🔄 RETRYING AI extraction with enhanced prompt...", file=sys.stderr)
                                                        
                                                        retry_prompt = f"""
                                                        CRITICAL: The previous AI extraction returned EMPTY data for this Romanian invoice. 
                                                        You MUST extract meaningful data from this document. FAILURE IS NOT ACCEPTED.
                                                        
                                                        Document text: {doc_text[:2000]}...
                                                        
                                                        REQUIRED EXTRACTION:
                                                        - vendor (company name)
                                                        - buyer (company name) 
                                                        - total_amount (numeric value)
                                                        - document_date (DD-MM-YYYY format)
                                                        - line_items array with at least one item
                                                        
                                                        Look for Romanian patterns: "Furnizor:", "Cumpărător:", "Total:", "Suma:", "Data:"
                                                        Extract ANY amounts, company names, dates you can find.
                                                        Return valid JSON with actual extracted data, not empty fields.
                                                        """
                                                        
                                                        response = client.chat.completions.create(
                                                            model="gpt-4o",
                                                            messages=[
                                                                {"role": "system", "content": "You are an expert Romanian invoice data extractor. You MUST extract meaningful data from documents. Never return empty responses."},
                                                                {"role": "user", "content": retry_prompt}
                                                            ],
                                                            max_tokens=3000,
                                                            temperature=0.1
                                                        )
                                                        
                                                        retry_result = response.choices[0].message.content
                                                        print(f"🔄 Retry response: {retry_result[:500]}...", file=sys.stderr)
                                                        
                                                        # Try to parse the retry result
                                                        retry_data = extract_json_from_text(retry_result)
                                                        if retry_data and isinstance(retry_data, dict):
                                                            # Check if retry has meaningful data
                                                            retry_has_data = (
                                                                retry_data.get('vendor') or 
                                                                retry_data.get('buyer') or 
                                                                retry_data.get('total_amount') or
                                                                (retry_data.get('line_items') and len(retry_data.get('line_items', [])) > 0)
                                                            )
                                                            if retry_has_data:
                                                                print(f"✅ RETRY SUCCESSFUL: AI extracted meaningful data on second attempt!", file=sys.stderr)
                                                                extraction_data.update(retry_data)
                                                            else:
                                                                print(f"❌ RETRY FAILED: AI still returned empty data on second attempt", file=sys.stderr)
                                                        else:
                                                            print(f"❌ RETRY FAILED: Could not parse retry response", file=sys.stderr)
                                                    else:
                                                        print(f"❌ RETRY FAILED: Could not extract document text for retry", file=sys.stderr)
                                                except Exception as e:
                                                    print(f"❌ RETRY FAILED: {str(e)}", file=sys.stderr)
                                            else:
                                                print(f"✅ AI extraction returned meaningful invoice data", file=sys.stderr)

                                        # Enhanced data validation and fallback for empty responses
                                        if expected_doc_type and expected_doc_type.lower() == 'invoice':
                                            # Ensure critical invoice fields exist
                                            if not extraction_data.get('vendor'):
                                                extraction_data['vendor'] = ""
                                                print("WARNING: Missing vendor field, setting empty string", file=sys.stderr)
                                            if not extraction_data.get('buyer'):
                                                extraction_data['buyer'] = ""
                                                print("WARNING: Missing buyer field, setting empty string", file=sys.stderr)
                                            if not extraction_data.get('total_amount'):
                                                extraction_data['total_amount'] = 0
                                                print("WARNING: Missing total_amount field, setting 0", file=sys.stderr)
                                            if not extraction_data.get('document_date'):
                                                extraction_data['document_date'] = ""
                                                print("WARNING: Missing document_date field, setting empty string", file=sys.stderr)
                                            if not extraction_data.get('line_items'):
                                                extraction_data['line_items'] = []
                                                print("WARNING: Missing line_items field, setting empty array", file=sys.stderr)
                                            if not extraction_data.get('currency'):
                                                extraction_data['currency'] = "RON"
                                                print("WARNING: Missing currency field, defaulting to RON", file=sys.stderr)

                                        combined_data.update(extraction_data)
                                        print(f"🐍 DEBUG: combined_data after update: {list(combined_data.keys())}", file=sys.stderr)
                                        print(f"🐍 DEBUG: combined_data document_type: {combined_data.get('document_type')}", file=sys.stderr)
                                    else:
                                        print(f"🐍 DEBUG: Task {i} extraction FAILED - no valid data returned", file=sys.stderr)
                                        if expected_doc_type and expected_doc_type.lower() != 'unknown':
                                            combined_data['document_type'] = standardize_document_type(expected_doc_type)
                                            print(f"🐍 DEBUG: Fallback - preserved document_type from phase 0: {combined_data['document_type']}", file=sys.stderr)
                                            
                                            # Create minimal invoice data structure
                                            if expected_doc_type.lower() == 'invoice':
                                                combined_data.update({
                                                    'vendor': '',
                                                    'buyer': '',
                                                    'total_amount': 0,
                                                    'document_date': '',
                                                    'line_items': [],
                                                    'currency': 'RON',
                                                    'vat_amount': 0
                                                })
                                                print("WARNING: Created minimal invoice structure due to extraction failure", file=sys.stderr)
                                elif i == 1:
                                    print(f"🐍 DEBUG: Processing Task {i} (Duplicate detection)", file=sys.stderr)
                                    try:
                                        duplicate_data = extract_json_from_text(task_output.raw)
                                        if duplicate_data and isinstance(duplicate_data, dict):
                                            combined_data['duplicate_detection'] = duplicate_data
                                            print(f"Duplicate detection completed: {duplicate_data.get('is_duplicate', False)}", file=sys.stderr)
                                    except Exception as dup_error:
                                        print(f"ERROR: Duplicate detection processing failed: {str(dup_error)}", file=sys.stderr)

                                elif i == 2:
                                    print(f"🐍 DEBUG: Processing Task {i} (Compliance validation)", file=sys.stderr)
                                    try:
                                        compliance_data = extract_json_from_text(task_output.raw)
                                        if compliance_data and isinstance(compliance_data, dict):
                                            combined_data['compliance_validation'] = compliance_data
                                            print(f"Compliance validation completed: {compliance_data.get('compliance_status', 'PENDING')}", file=sys.stderr)
                                    except Exception as comp_error:
                                        print(f"ERROR: Compliance validation processing failed: {str(comp_error)}", file=sys.stderr)
                            else:
                                print(f"🐍 DEBUG: Task {i} has no output or empty raw data", file=sys.stderr)

                    except Exception as e:
                        print(f"ERROR: Error processing task {i}: {str(e)}", file=sys.stderr)
                        continue

            if current_phase == 1:
                phase0_doc_type = inputs.get('phase0_data', {}).get('document_type')
                if phase0_doc_type and (not combined_data.get('document_type') or combined_data.get('document_type') == 'Unknown'):
                    combined_data['document_type'] = standardize_document_type(phase0_doc_type)
                    print(f"🐍 FINAL DEBUG: Restored document_type from phase 0: {combined_data['document_type']}", file=sys.stderr)

                if combined_data.get('document_type', '').lower() == 'invoice':
                    if inputs.get('direction'):
                        combined_data['direction'] = inputs.get('direction')
                
            is_valid, validation_errors = validate_processed_data(combined_data)
            
            # Check if we have meaningful data even if validation fails
            doc_type = combined_data.get('document_type', '').lower()
            has_meaningful_data = False
            
            if doc_type == 'invoice':
                has_meaningful_data = (
                    combined_data.get('vendor') or 
                    combined_data.get('buyer') or 
                    combined_data.get('total_amount') or
                    (combined_data.get('line_items') and len(combined_data.get('line_items', [])) > 0)
                )
            
            if is_valid or has_meaningful_data:
                print(f"✅ Processing successful on attempt {attempt + 1} (valid: {is_valid}, meaningful: {has_meaningful_data})", file=sys.stderr)
                return combined_data, True
            else:
                print(f"❌ Processing failed on attempt {attempt + 1}: {validation_errors}", file=sys.stderr)
                print(f"❌ No meaningful data extracted from document", file=sys.stderr)
                
                if attempt < max_retries:
                    print(f"🔄 Retrying processing (attempt {attempt + 2})", file=sys.stderr)
                    time.sleep(2)  
                    continue
                else:
                    print("🚨 Max retries reached, extraction completely failed!", file=sys.stderr)
                    print("🚨 This indicates a serious issue with OCR, AI prompts, or Chart of Accounts loading", file=sys.stderr)
                    fallback = create_fallback_response(combined_data.get('document_type', 'Unknown'))
                    if combined_data.get('document_type'):
                        fallback['document_type'] = combined_data['document_type']
                    if combined_data.get('duplicate_detection'):
                        fallback['duplicate_detection'] = combined_data['duplicate_detection']
                    return fallback, False
                    
        except Exception as e:
            print(f"Processing attempt {attempt + 1} failed with error: {str(e)}", file=sys.stderr)
            if attempt < max_retries:
                print(f"Retrying after error (attempt {attempt + 2})", file=sys.stderr)
                time.sleep(3)  
                continue
            else:
                print("Max retries reached after errors, returning fallback response", file=sys.stderr)
                return create_fallback_response(), False
    
    return create_fallback_response(), False

def standardize_document_type(doc_type: str) -> str:
    """Standardize document type casing to match expected format."""
    if not doc_type:
        return "Unknown"
    
    doc_type_lower = doc_type.lower().strip()
    
    type_mapping = {
        'invoice': 'Invoice',
        'factură': 'Invoice', 
        'factura': 'Invoice',
        'receipt': 'Receipt',
        'chitanță': 'Receipt',
        'chitanta': 'Receipt',
        'bank statement': 'Bank Statement',
        'extras de cont': 'Bank Statement',
        'contract': 'Contract',
        'z report': 'Z Report',
        'raport z': 'Z Report',
        'payment order': 'Payment Order',
        'dispozitie de plata': 'Payment Order',
        'collection order': 'Collection Order',
        'dispozitie de incasare': 'Collection Order'
    }
    
    return type_mapping.get(doc_type_lower, doc_type.title())

def process_account_attribution(transaction_file_path: str) -> Dict[str, Any]:
    """Process account attribution for a bank transaction."""
    try:
        with open(transaction_file_path, 'r', encoding='utf-8') as f:
            transaction_data = json.load(f)
        
        client_company_ein = transaction_data.get('clientCompanyEin')
        chart_of_accounts = transaction_data.get('chartOfAccounts', '')
        
        existing_articles = get_existing_articles()
        management_records = {"Depozit Central": {}, "Servicii": {}}
        user_corrections = load_user_corrections(client_company_ein)
        
        crew_instance = FirstCrewFinova(
            client_company_ein,
            existing_articles,
            management_records,
            user_corrections,
            0  
        )
        
        result = crew_instance.attribute_account_for_transaction(
            transaction_data,
            chart_of_accounts
        )
        
        return {"data": result}
        
    except Exception as e:
        print(f"ERROR: Account attribution failed: {str(e)}", file=sys.stderr)
        return {
            "error": str(e),
            "data": {
                "account_code": "628",
                "account_name": "Alte cheltuieli cu serviciile executate de terți",
                "confidence": 0.1,
                "reasoning": f"Attribution failed: {str(e)}"
            }
        }

def should_retry_document(result_data: Dict[str, Any], max_retries: int = 3) -> bool:
    """Check if a document should be retried based on extraction results."""
    if not result_data:
        return True
    
    # Check if document was marked for retry
    if result_data.get('_requires_retry'):
        retry_count = result_data.get('_retry_count', 0)
        if retry_count < max_retries:
            print(f"🔄 Document eligible for retry (attempt {retry_count + 1}/{max_retries})", file=sys.stderr)
            return True
        else:
            print(f"❌ Document exceeded max retries ({max_retries})", file=sys.stderr)
            return False
    
    # Check for empty invoice data
    if result_data.get('document_type', '').lower() == 'invoice':
        has_meaningful_data = (
            result_data.get('vendor') or 
            result_data.get('buyer') or 
            result_data.get('total_amount') or
            result_data.get('document_date') or
            (result_data.get('line_items') and len(result_data.get('line_items', [])) > 0)
        )
        
        if not has_meaningful_data:
            retry_count = result_data.get('_retry_count', 0)
            if retry_count < max_retries:
                print(f"🔄 Empty invoice data detected, eligible for retry (attempt {retry_count + 1}/{max_retries})", file=sys.stderr)
                return True
    
    return False

def process_retry_queue(documents: List[Dict[str, Any]], client_company_ein: str, max_retries: int = 3) -> List[Dict[str, Any]]:
    """Process documents that need retry based on empty responses."""
    retry_documents = []
    processed_documents = []
    
    for doc in documents:
        if should_retry_document(doc.get('data', {}), max_retries):
            retry_documents.append(doc)
            print(f"🔄 Adding to retry queue: {doc.get('filename', 'unknown')}", file=sys.stderr)
        else:
            processed_documents.append(doc)
    
    if retry_documents:
        print(f"🔄 Processing {len(retry_documents)} documents in retry queue...", file=sys.stderr)
        
        for doc in retry_documents:
            try:
                print(f"🔄 Retrying document: {doc.get('filename', 'unknown')}", file=sys.stderr)
                
                # Process with enhanced settings for retry
                result = process_single_document(
                    doc.get('filepath', ''),
                    client_company_ein,
                    processing_phase=1,
                    phase0_data=doc.get('phase0_data', {})
                )
                
                # Update the document with new results
                doc['data'] = result
                doc['lastAttempt'] = int(time.time() * 1000)
                doc['retryCount'] = doc.get('retryCount', 0) + 1
                
                # Check if retry was successful
                if not should_retry_document(result, max_retries):
                    print(f"✅ Retry successful for: {doc.get('filename', 'unknown')}", file=sys.stderr)
                    doc['state'] = 'processed'
                else:
                    print(f"❌ Retry still failed for: {doc.get('filename', 'unknown')}", file=sys.stderr)
                    doc['state'] = 'failed' if doc.get('retryCount', 0) >= max_retries else 'queued'
                
                processed_documents.append(doc)
                
            except Exception as e:
                print(f"❌ Retry processing failed for {doc.get('filename', 'unknown')}: {str(e)}", file=sys.stderr)
                doc['state'] = 'failed'
                processed_documents.append(doc)
    
    return processed_documents

def process_single_document(doc_path: str, client_company_ein: str, existing_documents: List[Dict] = None, processing_phase: int = 0, phase0_data: Dict[str, Any] = None) -> Dict[str, Any]:
    """Process a single document with memory optimization and improved error handling."""
    print(f"Starting process_single_document for EIN: {client_company_ein}", file=sys.stderr)
    log_memory_usage("Before processing")
    
    try:
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            error_msg = "OPENAI_API_KEY environment variable not found"
            print(f"ERROR: {error_msg}", file=sys.stderr)
            return {
                "error": error_msg,
                "details": "Please set the OPENAI_API_KEY environment variable"
            }
        
        print(f"API Key info - Length: {len(api_key)}, Starts with 'sk-': {api_key.startswith('sk-')}", file=sys.stderr)
        
        try:
            import openai
            print("Testing direct OpenAI connection...", file=sys.stderr)
            client = openai.OpenAI(api_key=api_key)
            test_response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": "test"}],
                max_tokens=5,
                timeout=30
            )
            print("Direct OpenAI API test PASSED", file=sys.stderr)
        except Exception as e:
            print(f"ERROR: Direct OpenAI API test FAILED: {str(e)}", file=sys.stderr)
            error_msg = str(e).lower()
            if "authentication" in error_msg or "api key" in error_msg or "unauthorized" in error_msg:
                return {
                    "error": "OpenAI API key is invalid or expired. Please check your API key.",
                    "details": str(e)
                }
            elif "rate limit" in error_msg:
                return {
                    "error": "OpenAI API rate limit exceeded. Please try again later.",
                    "details": str(e)
                }
            else:
                return {
                    "error": f"OpenAI API error: {str(e)}",
                    "details": str(e)
                }
        
        if not check_llm_configuration():
            return {
                "error": "LLM service not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.",
                "details": "No valid LLM API key found in environment variables"
            }
        
        print("Loading existing articles...", file=sys.stderr)
        existing_articles = get_existing_articles()
        management_records = {"Depozit Central": {}, "Servicii": {}}
        
        user_corrections = load_user_corrections(client_company_ein)
        
        document_hash = generate_document_hash(doc_path)
        
        log_memory_usage("After loading config")
        
        try:
            print("Creating FirstCrewFinova instance...", file=sys.stderr)
            crew_instance = FirstCrewFinova(
                client_company_ein, 
                existing_articles, 
                management_records, 
                user_corrections,
                processing_phase
            )
            print("FirstCrewFinova instance created successfully", file=sys.stderr)
            
        except Exception as e:
            print(f"ERROR: Failed to create CrewAI instance: {str(e)}", file=sys.stderr)
            return {
                "error": "Failed to initialize CrewAI. Check logs for details.",
                "details": str(e)
            }
        
        log_memory_usage("After crew creation")
        
        print(f"Processing document: {os.path.basename(doc_path)}", file=sys.stderr)

        current_date = datetime.now().strftime("%d/%m/%Y")
        print(f"Current date for validation: {current_date}", file=sys.stderr)
        
        inputs = {
            "document_path": doc_path,
            "client_company_ein": client_company_ein,
            "current_date": current_date,
            "processing_phase": processing_phase,
            "vendor_labels": ["Furnizor", "Vânzător", "Emitent", "Societate emitentă", "Prestator", "Societate"],
            "buyer_labels": ["Cumpărător", "Client", "Beneficiar", "Achizitor", "Societate client", "Destinatar"],
            "incoming_types": ["Nedefinit", "Marfuri", "Materii prime", "Materiale auxiliare", "Ambalaje", "Obiecte de inventar", "Amenajari provizorii", "Mat. spre prelucrare", "Mat. in pastrare/consig.", "Discount financiar intrari", "Combustibili", "Piese de schimb", "Alte mat. consumabile", "Discount comercial intrari", "Ambalaje SGR"],
            "outgoing_types": ["Nedefinit", "Marfuri", "Produse finite", "Ambalaje", "Produse reziduale", "Semifabricate", "Discount financiar iesiri", "Servicii vandute", "Discount comercial iesiri", "Ambalaje SGR", "Taxa verde"],
            "vat_rates": ["NINETEEN", "NINE", "FIVE", "ZERO"],
            "units_of_measure": ["BUCATA", "KILOGRAM", "LITRU", "METRU", "GRAM", "CUTIE", "PACHET", "PUNGA", "SET", "METRU_PATRAT", "METRU_CUB", "MILIMETRU", "CENTIMETRU", "TONA", "PERECHE", "SAC", "MILILITRU", "KILOWATT_ORA", "MINUT", "ORA", "ZI_DE_LUCRU", "LUNI_DE_LUCRU", "DOZA", "UNITATE_DE_SERVICE", "O_MIE_DE_BUCATI", "TRIMESTRU", "PROCENT", "KILOMETRU", "LADA", "DRY_TONE", "CENTIMETRU_PATRAT", "MEGAWATI_ORA", "ROLA", "TAMBUR", "SAC_PLASTIC", "PALET_LEMN", "UNITATE", "TONA_NETA", "HECTOMETRU_PATRAT", "FOAIE"],
            "existing_articles": existing_articles,
            "management_records": management_records,
            "existing_documents": existing_documents or [],
            "document_hash": document_hash,
            "doc_type": phase0_data.get("document_type", "Unknown") if phase0_data else "Unknown",
            "direction": phase0_data.get("direction", "") if phase0_data else "",
            "referenced_numbers": phase0_data.get("referenced_numbers", []) if phase0_data else [],
            "phase0_data": phase0_data,
            "romanian_chart_of_accounts": get_romanian_chart_of_accounts(),
        }

        print(f"🐍 DEBUG: inputs contains phase0_data: {'phase0_data' in inputs}", file=sys.stderr)
        print(f"🐍 DEBUG: phase0_data value: {inputs.get('phase0_data')}", file=sys.stderr)
        
        # Debug chart of accounts loading
        chart_content = get_romanian_chart_of_accounts()
        print(f"🐍 DEBUG: Chart of accounts loaded, length: {len(chart_content) if chart_content else 0}", file=sys.stderr)
        print(f"🐍 DEBUG: Chart content preview: {chart_content[:200] if chart_content else 'None'}", file=sys.stderr)
        print(f"🐍 DEBUG: Chart content ends with: {chart_content[-200:] if chart_content else 'None'}", file=sys.stderr)
        print(f"🐍 DEBUG: Chart contains 'Clasa 1': {'Clasa 1' in chart_content if chart_content else False}", file=sys.stderr)
        print(f"🐍 DEBUG: Chart contains '101. Capital': {'101. Capital' in chart_content if chart_content else False}", file=sys.stderr)
        
        # If chart is empty or None, this could cause the AI agent to fail
        if not chart_content or len(chart_content.strip()) == 0:
            print(f"🐍 ERROR: Chart of accounts is empty or None! This will cause AI agent to fail!", file=sys.stderr)
        
        # Debug all inputs being passed to the crew
        print(f"🐍 DEBUG: All inputs keys: {list(inputs.keys())}", file=sys.stderr)
        print(f"🐍 DEBUG: romanian_chart_of_accounts in inputs: {'romanian_chart_of_accounts' in inputs}", file=sys.stderr)
        
        if processing_phase == 1 and phase0_data:
            inputs["doc_type"] = phase0_data.get("document_type", "Unknown")
            inputs["direction"] = phase0_data.get("direction", "")
            inputs["referenced_numbers"] = phase0_data.get("referenced_numbers", [])
            print(f"Phase 1 inputs: doc_type={inputs['doc_type']}, direction={inputs['direction']}", file=sys.stderr)
        
        log_memory_usage("Before crew kickoff")
        
        combined_data, success = process_with_retry(crew_instance, inputs)
        
        if not success:
            print("Processing completed with fallback response", file=sys.stderr)
        
        # Check if this document should be retried
        if should_retry_document(combined_data):
            retry_count = combined_data.get('_retry_count', 0)
            combined_data['_retry_count'] = retry_count + 1
            combined_data['_retry_timestamp'] = int(time.time() * 1000)
            print(f"🔄 Document marked for retry (attempt {retry_count + 1}): {os.path.basename(doc_path)}", file=sys.stderr)
        
        del crew_instance
        del existing_articles
        del management_records
        
        doc_type = (combined_data.get('document_type') or '').lower()
        
        if doc_type != 'invoice':
            invoice_only_fields = ['vendor_ein', 'buyer_ein', 'direction', 'vat_amount']
            for field in invoice_only_fields:
                if field in combined_data and not combined_data.get(field):
                    combined_data.pop(field, None)
        
        if doc_type == 'invoice' and 'line_items' not in combined_data:
            combined_data['line_items'] = []
            print("WARNING: No line_items found for invoice, setting empty array", file=sys.stderr)
        
        if doc_type == 'bank statement' and 'transactions' not in combined_data:
            combined_data['transactions'] = []
            print("WARNING: No transactions found for bank statement, setting empty array", file=sys.stderr)
        
        # Final safety check to prevent completely empty responses
        if doc_type == 'invoice':
            # Check if we have any meaningful data at all
            has_any_data = (
                combined_data.get('vendor') or 
                combined_data.get('buyer') or 
                combined_data.get('total_amount') or
                combined_data.get('document_date') or
                (combined_data.get('line_items') and len(combined_data.get('line_items', [])) > 0)
            )
            
            if not has_any_data:
                print(f"🚨 CRITICAL: No meaningful data extracted from invoice document!", file=sys.stderr)
                print(f"🚨 This document should be re-queued for processing!", file=sys.stderr)
                
                # Mark this document for retry by adding a special flag
                combined_data['_requires_retry'] = True
                combined_data['_retry_reason'] = 'empty_extraction'
                combined_data['_retry_timestamp'] = int(time.time() * 1000)
                
                print(f"🔄 Document marked for retry queue: {os.path.basename(doc_path)}", file=sys.stderr)
            
            # Ensure all critical fields exist with fallback values
            critical_fields = {
                'vendor': '',
                'buyer': '',
                'total_amount': 0,
                'document_date': '',
                'line_items': [],
                'currency': 'RON',
                'vat_amount': 0
            }
            
            for field, default_value in critical_fields.items():
                if field not in combined_data or combined_data[field] is None:
                    combined_data[field] = default_value
                    print(f"FINAL SAFETY: Set missing {field} to {default_value}", file=sys.stderr)
        
        if 'duplicate_detection' not in combined_data:
            combined_data['duplicate_detection'] = {
                "is_duplicate": False,
                "duplicate_matches": [],
                "document_hash": document_hash,
                "confidence": 0.0
            }
        
        if 'compliance_validation' not in combined_data:
            combined_data['compliance_validation'] = {
                "compliance_status": "PENDING",
                "overall_score": 0.0,
                "validation_rules": {"ro": [], "en": []},
                "errors": {"ro": [], "en": []},
                "warnings": {"ro": [], "en": []}
            }
        
        log_memory_usage("After processing")

        print(f"🐍 FINAL DEBUG: About to return combined_data with keys: {list(combined_data.keys())}", file=sys.stderr)
        print(f"🐍 FINAL DEBUG: receipt_number in final data: {combined_data.get('receipt_number')}", file=sys.stderr)
        print(f"🐍 FINAL DEBUG: vendor in final data: {combined_data.get('vendor')}", file=sys.stderr)
        print(f"🐍 FINAL DEBUG: total_amount in final data: {combined_data.get('total_amount')}", file=sys.stderr)
        print(f"🐍 FINAL DEBUG: Full combined_data: {json.dumps(combined_data, default=str)[:1000]}...", file=sys.stderr)
        
        
        return {
            "data": combined_data
        }
        
    except Exception as e:
        print(f"ERROR: Unhandled exception in process_single_document: {str(e)}", file=sys.stderr)
        print(f"Traceback:\n{traceback.format_exc()}", file=sys.stderr)
        
        error_message = str(e)
        if any(keyword in error_message.lower() for keyword in ["api", "key", "authentication", "unauthorized", "forbidden"]):
            return {"error": "LLM API authentication failed. Please check your API key.", "details": error_message}
        elif any(keyword in error_message for keyword in ["LLM", "OpenAI", "rate limit", "quota"]):
            return {"error": "LLM service error. Please check API configuration or try again later.", "details": error_message}
        elif "memory" in error_message.lower() or "killed" in error_message.lower():
            return {"error": "Memory limit exceeded. Please try with a smaller document.", "details": error_message}
        elif "timeout" in error_message.lower():
            return {"error": "Processing timeout. Please try with a simpler document.", "details": error_message}
        
        return {"error": f"Processing failed: {str(e)}"}
    
    finally:
        cleanup_memory()
        log_memory_usage("After cleanup")

def read_base64_from_file(file_path: str) -> str:
    """Read base64 data from file with error handling."""
    try:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Base64 file not found: {file_path}")
            
        file_size = os.path.getsize(file_path)
        max_size = 100 * 1024 * 1024 
        
        if file_size > max_size:
            raise ValueError(f"Base64 file too large: {file_size // 1024 // 1024}MB")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read().strip()
            
        if not content:
            raise ValueError("Empty base64 file")
            
        print(f"Read base64 file: {file_path} ({file_size // 1024}KB)", file=sys.stderr)
        return content
        
    except Exception as e:
        print(f"ERROR: Error reading base64 file: {str(e)}", file=sys.stderr)
        raise

def main():
    """Main function with comprehensive error handling and memory management."""

    if len(sys.argv) >= 3 and sys.argv[1] == 'account_attribution':
        transaction_file_path = sys.argv[2]
        
        try:
            result = process_account_attribution(transaction_file_path)
            print(json.dumps(result, ensure_ascii=False))
            sys.exit(0)
        except Exception as e:
            error_result = {
                "error": str(e),
                "data": {
                    "account_code": "628",
                    "account_name": "Alte cheltuieli cu serviciile executate de terți",
                    "confidence": 0.1
                }
            }
            print(json.dumps(error_result, ensure_ascii=False))
            sys.exit(1)

    print(f"Python script started", file=sys.stderr)
    print(f"Python version: {sys.version}", file=sys.stderr)
    print(f"OPENAI_API_KEY exists: {bool(os.getenv('OPENAI_API_KEY'))}", file=sys.stderr)
    print(f"MODEL env var: {os.getenv('MODEL', 'NOT SET')}", file=sys.stderr)
    print(f"Current working directory: {os.getcwd()}", file=sys.stderr)
    
    try:
        import crewai
        print(f"CrewAI version: {crewai.__version__ if hasattr(crewai, '__version__') else 'unknown'}", file=sys.stderr)
    except ImportError as e:
        print(f"ERROR: Cannot import crewai: {e}", file=sys.stderr)
    
    try:
        import openai
        print(f"OpenAI version: {openai.__version__ if hasattr(openai, '__version__') else 'unknown'}", file=sys.stderr)
    except ImportError as e:
        print(f"ERROR: Cannot import openai: {e}", file=sys.stderr)

    memory_monitoring = setup_memory_monitoring()
    
    try:
        if len(sys.argv) < 7:
            result = {"error": "Usage: python main.py <client_company_ein> <base64_file_data_or_file_path> [existing_documents_json]"}
            print(json.dumps(result, ensure_ascii=False))
            sys.exit(1)
        
        client_company_ein = sys.argv[1].strip()
        base64_input = sys.argv[2].strip()
        existing_documents_file = sys.argv[3].strip()
        user_corrections_file = sys.argv[4].strip()
        existing_articles_file = sys.argv[5].strip()
        processing_phase = int(sys.argv[6].strip())
        phase0_data = json.loads(sys.argv[7].strip()) if len(sys.argv) > 7 else None

        existing_documents = []
        if os.path.exists(existing_documents_file):
            with open(existing_documents_file, 'r') as f:
                existing_documents = json.load(f)

        base64_data = read_base64_from_file(base64_input)
        temp_file_path = save_temp_file(base64_data)

        try:
            result = process_single_document(temp_file_path, client_company_ein, existing_documents, processing_phase, phase0_data)
            print(json.dumps(result, ensure_ascii=False))
        finally:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
        
        existing_documents = []
        if len(sys.argv) > 3:
            existing_documents_file = sys.argv[3].strip()

            print(f"🐍 PYTHON DEBUG: existing_documents_file path: {existing_documents_file}", file=sys.stderr)
            print(f"🐍 PYTHON DEBUG: File exists: {os.path.exists(existing_documents_file)}", file=sys.stderr)

            if os.path.exists(existing_documents_file):
                try:
                    with open(existing_documents_file, 'r') as f:
                        file_content = f.read()
                        print(f"🐍 PYTHON DEBUG: File size: {len(file_content)} bytes", file=sys.stderr)
                        print(f"🐍 PYTHON DEBUG: First 500 chars: {file_content[:500]}", file=sys.stderr)

                        existing_docs = json.loads(file_content)
                        existing_documents = existing_docs
                        print(f"🐍 PYTHON DEBUG: Parsed JSON, found {len(existing_documents)} documents", file=sys.stderr)
                        if len(existing_documents) > 0:
                            print(f"🐍 PYTHON DEBUG: First doc: {existing_documents[0]}", file=sys.stderr)
                except Exception as e:
                    print(f"🐍 PYTHON DEBUG: Error reading existing documents file: {e}", file=sys.stderr)
            else:
                print("🐍 PYTHON DEBUG: Existing documents file does not exist", file=sys.stderr)

        if not client_company_ein:
            result = {"error": "Client company EIN is required"}
            print(json.dumps(result, ensure_ascii=False))
            sys.exit(1)
        
        log_memory_usage("Startup")
        
        if os.path.exists(base64_input) and os.path.isfile(base64_input):
            base64_data = read_base64_from_file(base64_input)
        else:
            base64_data = base64_input
            
        if not base64_data:
            result = {"error": "No base64 data provided"}
            print(json.dumps(result, ensure_ascii=False))
            sys.exit(1)
        
        temp_file_path = save_temp_file(base64_data)
        
        try:
            result = process_single_document(temp_file_path, client_company_ein, existing_documents)
            
            print(json.dumps(result, ensure_ascii=False))
            
        finally:
            if os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                    print(f"Cleaned up temporary file: {temp_file_path}", file=sys.stderr)
                except Exception as e:
                    print(f"WARNING: Failed to remove temporary file: {str(e)}", file=sys.stderr)
        
    except KeyboardInterrupt:
        print("Processing interrupted by user", file=sys.stderr)
        print(json.dumps({"error": "Processing interrupted"}))
        sys.exit(1)
        
    except Exception as e:
        print(f"ERROR: Unhandled error in main: {str(e)}", file=sys.stderr)
        print(f"Traceback:\n{traceback.format_exc()}", file=sys.stderr)
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)
        
    finally:
        cleanup_memory()
        
        if memory_monitoring and tracemalloc.is_tracing():
            tracemalloc.stop()
        
        log_memory_usage("Exit")

if __name__ == "__main__":
    main()