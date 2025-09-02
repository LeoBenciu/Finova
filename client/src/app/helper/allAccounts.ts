export const allAccounts = [
    // Clasa 1 - Conturi de capitaluri, provizioane, imprumuturi si datorii asimilate
    
    // 10. Capital si rezerve
    { code: '101', name: 'Capital' },
    { code: '1011', name: 'Capital subscris nevarsat' },
    { code: '1012', name: 'Capital subscris varsat' },
    { code: '1015', name: 'Patrimoniul regiei' },
    { code: '1016', name: 'Patrimoniul public' },
    { code: '1017', name: 'Patrimoniul privat' },
    { code: '1018', name: 'Patrimoniul institutelor nationale de cercetare-dezvoltare' },
    
    { code: '103', name: 'Alte elemente de capitaluri proprii' },
    { code: '1031', name: 'Beneficii acordate angajatilor sub forma instrumentelor de capitaluri proprii' },
    { code: '1033', name: 'Diferente de curs valutar in relatie cu investitia neta intr-o entitate straina' },
    { code: '1038', name: 'Diferente din modificarea valorii juste a activelor financiare disponibile in vederea vanzarii si alte elemente de capitaluri proprii' },
    
    { code: '104', name: 'Prime de capital' },
    { code: '1041', name: 'Prime de emisiune' },
    { code: '1042', name: 'Prime de fuziune/divizare' },
    { code: '1043', name: 'Prime de aport' },
    { code: '1044', name: 'Prime de conversie a obligatiunilor in actiuni' },
    
    { code: '105', name: 'Rezerve din reevaluare' },
    
    { code: '106', name: 'Rezerve' },
    { code: '1061', name: 'Rezerve legale' },
    { code: '1063', name: 'Rezerve statutare sau contractuale' },
    { code: '1068', name: 'Alte rezerve' },
    
    { code: '107', name: 'Diferente de curs valutar din conversie' },
    
    { code: '108', name: 'Interese care nu controleaza' },
    { code: '1081', name: 'Interese care nu controleaza - rezultatul exercitiului financiar' },
    { code: '1082', name: 'Interese care nu controleaza - alte capitaluri proprii' },
    
    { code: '109', name: 'Actiuni proprii' },
    { code: '1091', name: 'Actiuni proprii detinute pe termen scurt' },
    { code: '1092', name: 'Actiuni proprii detinute pe termen lung' },
    { code: '1095', name: 'Actiuni proprii reprezentand titluri detinute de societatea absorbita la societatea absorbanta' },
    
    // 11. Rezultatul reportat
    { code: '117', name: 'Rezultatul reportat' },
    { code: '1171', name: 'Rezultatul reportat reprezentand profitul nerepartizat sau pierderea neacoperita' },
    { code: '1172', name: 'Rezultatul reportat provenit din adoptarea pentru prima data a IAS, mai putin IAS 29' },
    { code: '1173', name: 'Rezultatul reportat provenit din modificarile politicilor contabile' },
    { code: '1174', name: 'Rezultatul reportat provenit din corectarea erorilor contabile' },
    { code: '1175', name: 'Rezultatul reportat reprezentand surplusul realizat din rezerve din reevaluare' },
    { code: '1176', name: 'Rezultatul reportat provenit din trecerea la aplicarea reglementarilor contabile conforme cu directivele europene' },
    
    // 12. Rezultatul exercitiului financiar
    { code: '121', name: 'Profit sau pierdere' },
    { code: '129', name: 'Repartizarea profitului' },
    
    // 14. Castiguri sau pierderi legate de instrumentele de capitaluri proprii
    { code: '141', name: 'Castiguri legate de vanzarea sau anularea instrumentelor de capitaluri proprii' },
    { code: '1411', name: 'Castiguri legate de vanzarea instrumentelor de capitaluri proprii' },
    { code: '1412', name: 'Castiguri legate de anularea instrumentelor de capitaluri proprii' },
    
    { code: '149', name: 'Pierderi legate de emiterea, rascumpararea, vanzarea, cedarea cu titlu gratuit sau anularea instrumentelor de capitaluri proprii' },
    { code: '1491', name: 'Pierderi rezultate din vanzarea instrumentelor de capitaluri proprii' },
    { code: '1495', name: 'Pierderi rezultate din reorganizari, care sunt determinate de anularea titlurilor detinute' },
    { code: '1496', name: 'Pierderi rezultate din reorganizari de societati, corespunzatoare activului net negativ al societatii absorbite' },
    { code: '1498', name: 'Alte pierderi legate de instrumentele de capitaluri proprii' },
    
    // 15. Provizioane
    { code: '151', name: 'Provizioane' },
    { code: '1511', name: 'Provizioane pentru litigii' },
    { code: '1512', name: 'Provizioane pentru garantii acordate clientilor' },
    { code: '1513', name: 'Provizioane pentru dezafectare imobilizari corporale si alte actiuni similare legate de acestea' },
    { code: '1514', name: 'Provizioane pentru restructurare' },
    { code: '1515', name: 'Provizioane pentru pensii si obligatii similare' },
    { code: '1516', name: 'Provizioane pentru impozite' },
    { code: '1517', name: 'Provizioane pentru terminarea contractului de munca' },
    { code: '1518', name: 'Alte provizioane' },
    
    // 16. Imprumuturi si datorii asimilate
    { code: '161', name: 'Imprumuturi din emisiuni de obligatiuni' },
    { code: '1614', name: 'Imprumuturi externe din emisiuni de obligatiuni garantate de stat' },
    { code: '1615', name: 'Imprumuturi externe din emisiuni de obligatiuni garantate de banci' },
    { code: '1617', name: 'Imprumuturi interne din emisiuni de obligatiuni garantate de stat' },
    { code: '1618', name: 'Alte imprumuturi din emisiuni de obligatiuni' },
    
    { code: '162', name: 'Credite bancare pe termen lung' },
    { code: '1621', name: 'Credite bancare pe termen lung' },
    { code: '1622', name: 'Credite bancare pe termen lung nerambursate la scadenta' },
    { code: '1623', name: 'Credite externe guvernamentale' },
    { code: '1624', name: 'Credite bancare externe garantate de stat' },
    { code: '1625', name: 'Credite bancare externe garantate de banci' },
    { code: '1626', name: 'Credite de la trezoreria statului' },
    { code: '1627', name: 'Credite bancare interne garantate de stat' },
    
    { code: '166', name: 'Datorii care privesc imobilizarile financiare' },
    { code: '1661', name: 'Datorii fata de entitatile afiliate' },
    { code: '1663', name: 'Datorii fata de entitatile asociate si entitatile controlate in comun' },
    
    { code: '167', name: 'Alte imprumuturi si datorii asimilate' },
    
    { code: '168', name: 'Dobanzi aferente imprumuturilor si datoriilor asimilate' },
    { code: '1681', name: 'Dobanzi aferente imprumuturilor din emisiuni de obligatiuni' },
    { code: '1682', name: 'Dobanzi aferente creditelor bancare pe termen lung' },
    { code: '1685', name: 'Dobanzi aferente datoriilor fata de entitatile afiliate' },
    { code: '1686', name: 'Dobanzi aferente datoriilor fata de entitatile asociate si entitatile controlate in comun' },
    { code: '1687', name: 'Dobanzi aferente altor imprumuturi si datorii asimilate' },
    
    { code: '169', name: 'Prime privind rambursarea obligatiunilor si a altor datorii' },
    { code: '1691', name: 'Prime privind rambursarea obligatiunilor' },
    { code: '1692', name: 'Prime privind rambursarea altor datorii' },

    // Clasa 2 - Conturi de imobilizari
    
    // 20. Imobilizari necorporale
    { code: '201', name: 'Cheltuieli de constituire' },
    { code: '203', name: 'Cheltuieli de dezvoltare' },
    { code: '205', name: 'Concesiuni, brevete, licente, marci comerciale, drepturi si active similare' },
    { code: '206', name: 'Active necorporale de explorare si evaluare a resurselor minerale' },
    { code: '207', name: 'Fond comercial' },
    { code: '2071', name: 'Fond comercial pozitiv' },
    { code: '2075', name: 'Fond comercial negativ' },
    { code: '208', name: 'Alte imobilizari necorporale' },
    
    // 21. Imobilizari corporale
    { code: '211', name: 'Terenuri si amenajari de terenuri' },
    { code: '2111', name: 'Terenuri' },
    { code: '2112', name: 'Amenajari de terenuri' },
    { code: '212', name: 'Constructii' },
    { code: '213', name: 'Instalatii tehnice si mijloace de transport' },
    { code: '2131', name: 'Echipamente tehnologice (masini, utilaje si instalatii de lucru)' },
    { code: '2132', name: 'Aparate si instalatii de masurare, control si reglare' },
    { code: '2133', name: 'Mijloace de transport' },
    { code: '214', name: 'Mobilier, aparatura birotica, echipamente de protectie a valorilor umane si materiale si alte active corporale' },
    { code: '215', name: 'Investitii imobiliare' },
    { code: '216', name: 'Active corporale de explorare si evaluare a resurselor minerale' },
    { code: '217', name: 'Active biologice productive' },
    
    // 22. Imobilizari corporale in curs de aprovizionare
    { code: '223', name: 'Instalatii tehnice si mijloace de transport in curs de aprovizionare' },
    { code: '224', name: 'Mobilier, aparatura birotica, echipamente de protectie a valorilor umane si materiale si alte active corporale in curs de aprovizionare' },
    { code: '227', name: 'Active biologice productive in curs de aprovizionare' },
    
    // 23. Imobilizari in curs
    { code: '231', name: 'Imobilizari corporale in curs de executie' },
    { code: '235', name: 'Investitii imobiliare in curs de executie' },
    
    // 26. Imobilizari financiare
    { code: '261', name: 'Actiuni detinute la entitatile afiliate' },
    { code: '262', name: 'Actiuni detinute la entitati asociate' },
    { code: '263', name: 'Actiuni detinute la entitati controlate in comun' },
    { code: '264', name: 'Titluri puse in echivalenta' },
    { code: '265', name: 'Alte titluri imobilizate' },
    { code: '266', name: 'Certificate verzi amanate' },
    { code: '267', name: 'Creante imobilizate' },
    { code: '2671', name: 'Sume de incasat de la entitatile afiliate' },
    { code: '2672', name: 'Dobanda aferenta sumelor de incasat de la entitatile afiliate' },
    { code: '2673', name: 'Creante fata de entitatile asociate si entitatile controlate in comun' },
    { code: '2674', name: 'Dobanda aferenta creantelor fata de entitatile asociate si entitatile controlate in comun' },
    { code: '2675', name: 'Imprumuturi acordate pe termen lung' },
    { code: '2676', name: 'Dobanda aferenta imprumuturilor acordate pe termen lung' },
    { code: '2677', name: 'Obligatiuni achizitionate cu ocazia emisiunilor efectuate de terti' },
    { code: '2678', name: 'Alte creante imobilizate' },
    { code: '2679', name: 'Dobanzi aferente altor creante imobilizate' },
    { code: '269', name: 'Varsaminte de efectuat pentru imobilizari financiare' },
    { code: '2691', name: 'Varsaminte de efectuat privind actiunile detinute la entitatile afiliate' },
    { code: '2692', name: 'Varsaminte de efectuat privind actiunile detinute la entitati asociate' },
    { code: '2693', name: 'Varsaminte de efectuat privind actiunile detinute la entitati controlate in comun' },
    { code: '2695', name: 'Varsaminte de efectuat pentru alte imobilizari financiare' },
    
    // 28. Amortizari privind imobilizarile
    { code: '280', name: 'Amortizari privind imobilizarile necorporale' },
    { code: '2801', name: 'Amortizarea cheltuielilor de constituire' },
    { code: '2803', name: 'Amortizarea cheltuielilor de dezvoltare' },
    { code: '2805', name: 'Amortizarea concesiunilor, brevetelor, licentelor, marcilor comerciale, drepturilor si activelor similare' },
    { code: '2806', name: 'Amortizarea activelor necorporale de explorare si evaluare a resurselor minerale' },
    { code: '2807', name: 'Amortizarea fondului comercial' },
    { code: '2808', name: 'Amortizarea altor imobilizari necorporale' },
    { code: '281', name: 'Amortizari privind imobilizarile corporale' },
    { code: '2811', name: 'Amortizarea amenajarilor de terenuri' },
    { code: '2812', name: 'Amortizarea constructiilor' },
    { code: '2813', name: 'Amortizarea instalatiilor si mijloacelor de transport' },
    { code: '2814', name: 'Amortizarea altor imobilizari corporale' },
    { code: '2815', name: 'Amortizarea investitiilor imobiliare' },
    { code: '2816', name: 'Amortizarea activelor corporale de explorare si evaluare a resurselor minerale' },
    { code: '2817', name: 'Amortizarea activelor biologice productive' },
    
    // 29. Ajustari pentru deprecierea sau pierderea de valoare a imobilizarilor
    { code: '290', name: 'Ajustari pentru deprecierea imobilizarilor necorporale' },
    { code: '2903', name: 'Ajustari pentru deprecierea cheltuielilor de dezvoltare' },
    { code: '2905', name: 'Ajustari pentru deprecierea concesiunilor, brevetelor, licentelor, marcilor comerciale, drepturilor si activelor similare' },
    { code: '2906', name: 'Ajustari pentru deprecierea activelor necorporale de explorare si evaluare a resurselor minerale' },
    { code: '2908', name: 'Ajustari pentru deprecierea altor imobilizari necorporale' },
    { code: '291', name: 'Ajustari pentru deprecierea imobilizarilor corporale' },
    { code: '2911', name: 'Ajustari pentru deprecierea terenurilor si amenajarilor de terenuri' },
    { code: '2912', name: 'Ajustari pentru deprecierea constructiilor' },
    { code: '2913', name: 'Ajustari pentru deprecierea instalatiilor si mijloacelor de transport' },
    { code: '2914', name: 'Ajustari pentru deprecierea altor imobilizari corporale' },
    { code: '2915', name: 'Ajustari pentru deprecierea investitiilor imobiliare' },
    { code: '2916', name: 'Ajustari pentru deprecierea activelor corporale de explorare si evaluare a resurselor minerale' },
    { code: '2917', name: 'Ajustari pentru deprecierea activelor biologice productive' },
    { code: '293', name: 'Ajustari pentru deprecierea imobilizarilor in curs de executie' },
    { code: '2931', name: 'Ajustari pentru deprecierea imobilizarilor corporale in curs de executie' },
    { code: '2935', name: 'Ajustari pentru deprecierea investitiilor imobiliare in curs de executie' },
    { code: '296', name: 'Ajustari pentru pierderea de valoare a imobilizarilor financiare' },
    { code: '2961', name: 'Ajustari pentru pierderea de valoare a actiunilor detinute la entitatile afiliate' },
    { code: '2962', name: 'Ajustari pentru pierderea de valoare a actiunilor detinute la entitati asociate si entitati controlate in comun' },
    { code: '2963', name: 'Ajustari pentru pierderea de valoare a altor titluri imobilizate' },
    { code: '2964', name: 'Ajustari pentru pierderea de valoare a sumelor de incasat de la entitatile afiliate' },
    { code: '2965', name: 'Ajustari pentru pierderea de valoare a creantelor fata de entitatile asociate si entitatile controlate in comun' },
    { code: '2966', name: 'Ajustari pentru pierderea de valoare a imprumuturilor acordate pe termen lung' },
    { code: '2968', name: 'Ajustari pentru pierderea de valoare a altor creante imobilizate' },

    // Clasa 3 - Conturi de stocuri si productie in curs de executie
    
    // 30. Stocuri de materii prime si materiale
    { code: '301', name: 'Materii prime' },
    { code: '302', name: 'Materiale consumabile' },
    { code: '3021', name: 'Materiale auxiliare' },
    { code: '3022', name: 'Combustibili' },
    { code: '3023', name: 'Materiale pentru ambalat' },
    { code: '3024', name: 'Piese de schimb' },
    { code: '3025', name: 'Seminte si materiale de plantat' },
    { code: '3026', name: 'Furaje' },
    { code: '3028', name: 'Alte materiale consumabile' },
    { code: '303', name: 'Materiale de natura obiectelor de inventar' },
    { code: '308', name: 'Diferente de pret la materii prime si materiale' },
    
    // 32. Stocuri in curs de aprovizionare
    { code: '321', name: 'Materii prime in curs de aprovizionare' },
    { code: '322', name: 'Materiale consumabile in curs de aprovizionare' },
    { code: '323', name: 'Materiale de natura obiectelor de inventar in curs de aprovizionare' },
    { code: '326', name: 'Active biologice de natura stocurilor in curs de aprovizionare' },
    { code: '327', name: 'Marfuri in curs de aprovizionare' },
    { code: '328', name: 'Ambalaje in curs de aprovizionare' },
    
    // 33. Productie in curs de executie
    { code: '331', name: 'Produse in curs de executie' },
    { code: '332', name: 'Servicii in curs de executie' },
    
    // 34. Produse
    { code: '341', name: 'Semifabricate' },
    { code: '345', name: 'Produse finite' },
    { code: '346', name: 'Produse reziduale' },
    { code: '347', name: 'Produse agricole' },
    { code: '348', name: 'Diferente de pret la produse' },
    
    // 35. Stocuri aflate la terti
    { code: '351', name: 'Materii si materiale aflate la terti' },
    { code: '354', name: 'Produse aflate la terti' },
    { code: '356', name: 'Active biologice de natura stocurilor aflate la terti' },
    { code: '357', name: 'Marfuri aflate la terti' },
    { code: '358', name: 'Ambalaje aflate la terti' },
    
    // 36. Active biologice de natura stocurilor
    { code: '361', name: 'Active biologice de natura stocurilor' },
    { code: '368', name: 'Diferente de pret la active biologice de natura stocurilor' },
    
    // 37. Marfuri
    { code: '371', name: 'Marfuri' },
    { code: '378', name: 'Diferente de pret la marfuri' },
    
    // 38. Ambalaje
    { code: '381', name: 'Ambalaje' },
    { code: '388', name: 'Diferente de pret la ambalaje' },
    
    // 39. Ajustari pentru deprecierea stocurilor si productiei in curs de executie
    { code: '391', name: 'Ajustari pentru deprecierea materiilor prime' },
    { code: '392', name: 'Ajustari pentru deprecierea materialelor' },
    { code: '3921', name: 'Ajustari pentru deprecierea materialelor consumabile' },
    { code: '3922', name: 'Ajustari pentru deprecierea materialelor de natura obiectelor de inventar' },
    { code: '393', name: 'Ajustari pentru deprecierea productiei in curs de executie' },
    { code: '394', name: 'Ajustari pentru deprecierea produselor' },
    { code: '3941', name: 'Ajustari pentru deprecierea semifabricatelor' },
    { code: '3945', name: 'Ajustari pentru deprecierea produselor finite' },
    { code: '3946', name: 'Ajustari pentru deprecierea produselor reziduale' },
    { code: '3947', name: 'Ajustari pentru deprecierea produselor agricole' },
    { code: '395', name: 'Ajustari pentru deprecierea stocurilor aflate la terti' },
    { code: '3951', name: 'Ajustari pentru deprecierea materiilor si materialelor aflate la terti' },
    { code: '3952', name: 'Ajustari pentru deprecierea semifabricatelor aflate la terti' },
    { code: '3953', name: 'Ajustari pentru deprecierea produselor finite aflate la terti' },
    { code: '3954', name: 'Ajustari pentru deprecierea produselor reziduale aflate la terti' },
    { code: '3955', name: 'Ajustari pentru deprecierea produselor agricole aflate la terti' },
    { code: '3956', name: 'Ajustari pentru deprecierea activelor biologice de natura stocurilor aflate la terti' },
    { code: '3957', name: 'Ajustari pentru deprecierea marfurilor aflate la terti' },
    { code: '3958', name: 'Ajustari pentru deprecierea ambalajelor aflate la terti' },
    { code: '396', name: 'Ajustari pentru deprecierea activelor biologice de natura stocurilor' },
    { code: '397', name: 'Ajustari pentru deprecierea marfurilor' },
    { code: '398', name: 'Ajustari pentru deprecierea ambalajelor' },

    // Clasa 4 - Conturi de terti
    
    // 40. Furnizori si conturi asimilate
    { code: '401', name: 'Furnizori' },
    { code: '403', name: 'Efecte de platit' },
    { code: '404', name: 'Furnizori de imobilizari' },
    { code: '405', name: 'Efecte de platit pentru imobilizari' },
    { code: '408', name: 'Furnizori - facturi nesosite' },
    { code: '409', name: 'Furnizori - debitori' },
    { code: '4091', name: 'Furnizori - debitori pentru cumparari de bunuri de natura stocurilor' },
    { code: '4092', name: 'Furnizori - debitori pentru prestari de servicii' },
    { code: '4093', name: 'Avansuri acordate pentru imobilizari corporale' },
    { code: '4094', name: 'Avansuri acordate pentru imobilizari necorporale' },
    
    // 41. Clienti si conturi asimilate
    { code: '411', name: 'Clienti' },
    { code: '4111', name: 'Clienti' },
    { code: '4118', name: 'Clienti incerti sau in litigiu' },
    { code: '413', name: 'Efecte de primit de la clienti' },
    { code: '418', name: 'Clienti - facturi de intocmit' },
    { code: '419', name: 'Clienti - creditori' },
    
    // 42. Personal si conturi asimilate
    { code: '421', name: 'Personal - salarii datorate' },
    { code: '423', name: 'Personal - ajutoare materiale datorate' },
    { code: '424', name: 'Prime reprezentand participarea personalului la profit' },
    { code: '425', name: 'Avansuri acordate personalului' },
    { code: '426', name: 'Drepturi de personal neridicate' },
    { code: '427', name: 'Retineri din salarii datorate tertilor' },
    { code: '428', name: 'Alte datorii si creante in legatura cu personalul' },
    { code: '4281', name: 'Alte datorii in legatura cu personalul' },
    { code: '4282', name: 'Alte creante in legatura cu personalul' },
    
    // 43. Asigurari sociale, protectia sociala si conturi asimilate
    { code: '431', name: 'Asigurari sociale' },
    { code: '4311', name: 'Contributia unitatii la asigurarile sociale' },
    { code: '4312', name: 'Contributia personalului la asigurarile sociale' },
    { code: '4313', name: 'Contributia angajatorului pentru asigurarile sociale de sanatate' },
    { code: '4314', name: 'Contributia angajatilor pentru asigurarile sociale de sanatate' },
    { code: '4315', name: 'Contributia de asigurari sociale' },
    { code: '4316', name: 'Contributia de asigurari sociale de sanatate' },
    { code: '4318', name: 'Alte contributii pentru asigurarile sociale de sanatate' },
    { code: '436', name: 'Contributia asiguratorie pentru munca' },
    { code: '437', name: 'Ajutor de somaj' },
    { code: '4371', name: 'Contributia unitatii la fondul de somaj' },
    { code: '4372', name: 'Contributia personalului la fondul de somaj' },
    { code: '438', name: 'Alte datorii si creante sociale' },
    { code: '4381', name: 'Alte datorii sociale' },
    { code: '4382', name: 'Alte creante sociale' },
    
    // 44. Bugetul statului, fonduri speciale si conturi asimilate
    { code: '441', name: 'Impozitul pe profit si alte impozite' },
    { code: '4411', name: 'Impozitul pe profit' },
    { code: '4415', name: 'Impozitul specific unor activitati' },
    { code: '4417', name: 'Impozitul pe profit la nivelul impozitului minim pe cifra de afaceri' },
    { code: '4418', name: 'Impozitul pe venit' },
    { code: '442', name: 'Taxa pe valoarea adaugata' },
    { code: '4423', name: 'TVA de plata' },
    { code: '4424', name: 'TVA de recuperat' },
    { code: '4426', name: 'TVA deductibila' },
    { code: '4427', name: 'TVA colectata' },
    { code: '4428', name: 'TVA neexigibila' },
    { code: '444', name: 'Impozitul pe venituri de natura salariilor' },
    { code: '445', name: 'Subventii' },
    { code: '4451', name: 'Subventii guvernamentale' },
    { code: '4452', name: 'Imprumuturi nerambursabile cu caracter de subventii' },
    { code: '4458', name: 'Alte sume primite cu caracter de subventii' },
    { code: '446', name: 'Alte impozite, taxe si varsaminte asimilate' },
    { code: '447', name: 'Fonduri speciale - taxe si varsaminte asimilate' },
    { code: '448', name: 'Alte datorii si creante cu bugetul statului' },
    { code: '4481', name: 'Alte datorii fata de bugetul statului' },
    { code: '4482', name: 'Alte creante privind bugetul statului' },
    
    // 45. Grup si actionari/asociati
    { code: '451', name: 'Decontari intre entitatile afiliate' },
    { code: '4511', name: 'Decontari intre entitatile afiliate' },
    { code: '4518', name: 'Dobanzi aferente decontarilor intre entitatile afiliate' },
    { code: '453', name: 'Decontari cu entitatile asociate si entitatile controlate in comun' },
    { code: '4531', name: 'Decontari cu entitatile asociate si entitatile controlate in comun' },
    { code: '4538', name: 'Dobanzi aferente decontarilor cu entitatile asociate si entitatile controlate in comun' },
    { code: '455', name: 'Sume datorate actionarilor/asociatilor' },
    { code: '4551', name: 'Actionari/Asociati - conturi curente' },
    { code: '4558', name: 'Actionari/Asociati - dobanzi la conturi curente' },
    { code: '456', name: 'Decontari cu actionarii/asociatii privind capitalul' },
    { code: '457', name: 'Dividende de plata' },
    { code: '458', name: 'Decontari din operatiuni in participatie' },
    { code: '4581', name: 'Decontari din operatiuni in participatie - pasiv' },
    { code: '4582', name: 'Decontari din operatiuni in participatie - activ' },
    
    // 46. Debitori si creditori diversi
    { code: '461', name: 'Debitori diversi' },
    { code: '462', name: 'Creditori diversi' },
    { code: '463', name: 'Creante reprezentand dividende repartizate in cursul exercitiului financiar' },
    { code: '466', name: 'Decontari din operatiuni de fiducie' },
    { code: '4661', name: 'Datorii din operatiuni de fiducie' },
    { code: '4662', name: 'Creante din operatiuni de fiducie' },
    { code: '467', name: 'Datorii aferente distribuirilor interimare de dividende' },
    
    // 47. Conturi de subventii, regularizare si asimilate
    { code: '471', name: 'Cheltuieli inregistrate in avans' },
    { code: '472', name: 'Venituri inregistrate in avans' },
    { code: '473', name: 'Decontari din operatiuni in curs de clarificare' },
    { code: '475', name: 'Subventii pentru investitii' },
    { code: '4751', name: 'Subventii guvernamentale pentru investitii' },
    { code: '4752', name: 'Imprumuturi nerambursabile cu caracter de subventii pentru investitii' },
    { code: '4753', name: 'Donatii pentru investitii' },
    { code: '4754', name: 'Plusuri de inventar de natura imobilizarilor' },
    { code: '4758', name: 'Alte sume primite cu caracter de subventii pentru investitii' },
    { code: '478', name: 'Venituri in avans aferente activelor primite prin transfer de la clienti' },
    
    // 48. Decontari in cadrul unitatii
    { code: '481', name: 'Decontari intre unitate si subunitati' },
    { code: '482', name: 'Decontari intre subunitati' },
    
    // 49. Ajustari pentru deprecierea creantelor
    { code: '490', name: 'Ajustari pentru deprecierea creantelor reprezentand avansuri acordate furnizorilor' },
    { code: '4901', name: 'Ajustari pentru deprecierea creantelor aferente cumpararilor de bunuri de natura stocurilor' },
    { code: '4902', name: 'Ajustari pentru deprecierea creantelor aferente prestarilor de servicii' },
    { code: '4903', name: 'Ajustari pentru deprecierea creantelor aferente imobilizarilor corporale' },
    { code: '4904', name: 'Ajustari pentru deprecierea creantelor aferente imobilizarilor necorporale' },
    { code: '491', name: 'Ajustari pentru deprecierea creantelor - clienti' },
    { code: '495', name: 'Ajustari pentru deprecierea creantelor - decontari in cadrul grupului si cu actionarii/asociatii' },
    { code: '496', name: 'Ajustari pentru deprecierea creantelor - debitori diversi' },

    // Clasa 5 - Conturi de trezorerie
    
    // 50. Investitii pe termen scurt
    { code: '501', name: 'Actiuni detinute la entitatile afiliate' },
    { code: '505', name: 'Obligatiuni emise si rascumparate' },
    { code: '506', name: 'Obligatiuni' },
    { code: '507', name: 'Certificate verzi primite' },
    { code: '508', name: 'Alte investitii pe termen scurt si creante asimilate' },
    { code: '5081', name: 'Alte titluri de plasament' },
    { code: '5088', name: 'Dobanzi la obligatiuni si titluri de plasament' },
    { code: '509', name: 'Varsaminte de efectuat pentru investitiile pe termen scurt' },
    { code: '5091', name: 'Varsaminte de efectuat pentru actiunile detinute la entitatile afiliate' },
    { code: '5092', name: 'Varsaminte de efectuat pentru alte investitii pe termen scurt' },
    
    // 51. Conturi la banci
    { code: '511', name: 'Valori de incasat' },
    { code: '5112', name: 'Cecuri de incasat' },
    { code: '5113', name: 'Efecte de incasat' },
    { code: '5114', name: 'Efecte remise spre scontare' },
    { code: '512', name: 'Conturi curente la banci' },
    { code: '5121', name: 'Conturi la banci in lei' },
    { code: '5124', name: 'Conturi la banci in valuta' },
    { code: '5125', name: 'Sume in curs de decontare' },
    { code: '518', name: 'Dobanzi' },
    { code: '5186', name: 'Dobanzi de platit' },
    { code: '5187', name: 'Dobanzi de incasat' },
    { code: '519', name: 'Credite bancare pe termen scurt' },
    { code: '5191', name: 'Credite bancare pe termen scurt' },
    { code: '5192', name: 'Credite bancare pe termen scurt nerambursate la scadenta' },
    { code: '5193', name: 'Credite externe guvernamentale' },
    { code: '5194', name: 'Credite externe garantate de stat' },
    { code: '5195', name: 'Credite externe garantate de banci' },
    { code: '5196', name: 'Credite de la Trezoreria Statului' },
    { code: '5197', name: 'Credite interne garantate de stat' },
    { code: '5198', name: 'Dobanzi aferente creditelor bancare pe termen scurt' },
    
    // 53. Casa
    { code: '531', name: 'Casa' },
    { code: '5311', name: 'Casa in lei' },
    { code: '5314', name: 'Casa in valuta' },
    { code: '532', name: 'Alte valori' },
    { code: '5321', name: 'Timbre fiscale si postale' },
    { code: '5322', name: 'Bilete de tratament si odihna' },
    { code: '5323', name: 'Tichete si bilete de calatorie' },
    { code: '5328', name: 'Alte valori' },
    
    // 54. Acreditive
    { code: '541', name: 'Acreditive' },
    { code: '5411', name: 'Acreditive in lei' },
    { code: '5414', name: 'Acreditive in valuta' },
    { code: '542', name: 'Avansuri de trezorerie' },
    
    // 58. Viramente interne
    { code: '581', name: 'Viramente interne' },
    
    // 59. Ajustari pentru pierderea de valoare a conturilor de trezorerie
    { code: '591', name: 'Ajustari pentru pierderea de valoare a actiunilor detinute la entitatile afiliate' },
    { code: '595', name: 'Ajustari pentru pierderea de valoare a obligatiunilor emise si rascumparate' },
    { code: '596', name: 'Ajustari pentru pierderea de valoare a obligatiunilor' },
    { code: '598', name: 'Ajustari pentru pierderea de valoare a altor investitii pe termen scurt si creante asimilate' },

    // Clasa 6 - Conturi de cheltuieli
    
    // 60. Cheltuieli privind stocurile si alte consumuri
    { code: '601', name: 'Cheltuieli cu materiile prime' },
    { code: '602', name: 'Cheltuieli cu materialele consumabile' },
    { code: '6021', name: 'Cheltuieli cu materialele auxiliare' },
    { code: '6022', name: 'Cheltuieli privind combustibilii' },
    { code: '6023', name: 'Cheltuieli privind materialele pentru ambalat' },
    { code: '6024', name: 'Cheltuieli privind piesele de schimb' },
    { code: '6025', name: 'Cheltuieli privind semintele si materialele de plantat' },
    { code: '6026', name: 'Cheltuieli privind furajele' },
    { code: '6028', name: 'Cheltuieli privind alte materiale consumabile' },
    { code: '603', name: 'Cheltuieli privind materialele de natura obiectelor de inventar' },
    { code: '604', name: 'Cheltuieli privind materialele nestocate' },
    { code: '605', name: 'Cheltuieli privind utilitatile' },
    { code: '6051', name: 'Cheltuieli privind consumul de energie' },
    { code: '6052', name: 'Cheltuieli privind consumul de apa' },
    { code: '6053', name: 'Cheltuieli privind consumul de gaze naturale' },
    { code: '6058', name: 'Cheltuieli cu alte utilitati' },
    { code: '606', name: 'Cheltuieli privind activele biologice de natura stocurilor' },
    { code: '607', name: 'Cheltuieli privind marfurile' },
    { code: '608', name: 'Cheltuieli privind ambalajele' },
    { code: '609', name: 'Reduceri comerciale primite' },
    
    // 61. Cheltuieli cu serviciile executate de terti
    { code: '611', name: 'Cheltuieli cu intretinerea si reparatiile' },
    { code: '612', name: 'Cheltuieli cu redeventele, locatiile de gestiune si chiriile' },
    { code: '6121', name: 'Cheltuieli cu redeventele' },
    { code: '6122', name: 'Cheltuieli cu locatiile de gestiune' },
    { code: '6123', name: 'Cheltuieli cu chiriile' },
    { code: '613', name: 'Cheltuieli cu primele de asigurare' },
    { code: '614', name: 'Cheltuieli cu studiile si cercetarile' },
    { code: '615', name: 'Cheltuieli cu pregatirea personalului' },
    { code: '616', name: 'Cheltuieli aferente drepturilor de proprietate intelectuala' },
    { code: '617', name: 'Cheltuieli de management' },
    { code: '618', name: 'Cheltuieli de consultanta' },
    
    // 62. Cheltuieli cu alte servicii executate de terti
    { code: '621', name: 'Cheltuieli cu colaboratorii' },
    { code: '622', name: 'Cheltuieli privind comisioanele si onorariile' },
    { code: '623', name: 'Cheltuieli de protocol, reclama si publicitate' },
    { code: '6231', name: 'Cheltuieli de protocol' },
    { code: '6232', name: 'Cheltuieli de reclama si publicitate' },
    { code: '624', name: 'Cheltuieli cu transportul de bunuri si personal' },
    { code: '625', name: 'Cheltuieli cu deplasari, detasari si transferari' },
    { code: '626', name: 'Cheltuieli postale si taxe de telecomunicatii' },
    { code: '627', name: 'Cheltuieli cu serviciile bancare si asimilate' },
    { code: '628', name: 'Alte cheltuieli cu serviciile executate de terti' },
    
    // 63. Cheltuieli cu alte impozite, taxe si varsaminte asimilate
    { code: '635', name: 'Cheltuieli cu alte impozite, taxe si varsaminte asimilate' },
    { code: '6351', name: 'Cheltuieli cu impozitul suplimentar pentru sectoarele de activitate specifice' },
    
    // 64. Cheltuieli cu personalul
    { code: '641', name: 'Cheltuieli cu salariile personalului' },
    { code: '642', name: 'Cheltuieli cu avantajele in natura si tichetele acordate salariatilor' },
    { code: '6421', name: 'Cheltuieli cu avantajele in natura acordate salariatilor' },
    { code: '6422', name: 'Cheltuieli cu tichetele acordate salariatilor' },
    { code: '643', name: 'Cheltuieli cu remunerarea in instrumente de capitaluri proprii' },
    { code: '644', name: 'Cheltuieli cu primele reprezentand participarea personalului la profit' },
    { code: '645', name: 'Cheltuieli privind asigurarile si protectia sociala' },
    { code: '6451', name: 'Cheltuieli privind contributia unitatii la asigurarile sociale' },
    { code: '6452', name: 'Cheltuieli privind contributia unitatii pentru ajutorul de somaj' },
    { code: '6453', name: 'Cheltuieli privind contributia angajatorului pentru asigurarile sociale de sanatate' },
    { code: '6455', name: 'Cheltuieli privind contributia unitatii la asigurarile de viata' },
    { code: '6456', name: 'Cheltuieli privind contributia unitatii la fondurile de pensii facultative' },
    { code: '6457', name: 'Cheltuieli privind contributia unitatii la primele de asigurare voluntara de sanatate' },
    { code: '6458', name: 'Alte cheltuieli privind asigurarile si protectia sociala' },
    { code: '646', name: 'Cheltuieli privind contributia asiguratorie pentru munca' },
    { code: '6461', name: 'Cheltuieli privind contributia asiguratorie pentru munca corespunzatoare salariatilor' },
    { code: '6462', name: 'Cheltuieli privind contributia asiguratorie pentru munca corespunzatoare altor persoane, decat salariatii' },
    
    // 65. Alte cheltuieli de exploatare
    { code: '651', name: 'Cheltuieli din operatiuni de fiducie' },
    { code: '6511', name: 'Cheltuieli ocazionate de constituirea fiduciei' },
    { code: '6512', name: 'Cheltuieli din derularea operatiunilor de fiducie' },
    { code: '6513', name: 'Cheltuieli din lichidarea operatiunilor de fiducie' },
    { code: '652', name: 'Cheltuieli cu protectia mediului inconjurator' },
    { code: '654', name: 'Pierderi din creante si debitori diversi' },
    { code: '655', name: 'Cheltuieli din reevaluarea imobilizarilor corporale' },
    { code: '658', name: 'Alte cheltuieli de exploatare' },
    { code: '6581', name: 'Despagubiri, amenzi si penalitati' },
    { code: '6582', name: 'Donatii acordate' },
    { code: '6583', name: 'Cheltuieli privind activele cedate si alte operatiuni de capital' },
    { code: '6584', name: 'Cheltuieli cu sumele sau bunurile acordate ca sponsorizari' },
    { code: '6586', name: 'Cheltuieli reprezentand transferuri si contributii datorate in baza unor acte normative speciale' },
    { code: '6587', name: 'Cheltuieli privind calamitatile si alte evenimente similare' },
    { code: '6588', name: 'Alte cheltuieli de exploatare' },
    
    // 66. Cheltuieli financiare
    { code: '663', name: 'Pierderi din creante legate de participatii' },
    { code: '664', name: 'Cheltuieli privind investitiile financiare cedate' },
    { code: '6641', name: 'Cheltuieli privind imobilizarile financiare cedate' },
    { code: '6642', name: 'Pierderi din investitiile pe termen scurt cedate' },
    { code: '665', name: 'Cheltuieli din diferente de curs valutar' },
    { code: '6651', name: 'Diferente nefavorabile de curs valutar legate de elementele monetare exprimate in valuta' },
    { code: '6652', name: 'Diferente nefavorabile de curs valutar din evaluarea elementelor monetare care fac parte din investitia neta intr-o entitate straina' },
    { code: '666', name: 'Cheltuieli privind dobanzile' },
    { code: '667', name: 'Cheltuieli privind sconturile acordate' },
    { code: '668', name: 'Alte cheltuieli financiare' },
    
    // 68. Cheltuieli cu amortizarile, provizioanele si ajustarile pentru depreciere sau pierdere de valoare
    { code: '681', name: 'Cheltuieli de exploatare privind amortizarile, provizioanele si ajustarile pentru depreciere' },
    { code: '6811', name: 'Cheltuieli de exploatare privind amortizarea imobilizarilor' },
    { code: '6812', name: 'Cheltuieli de exploatare privind provizioanele' },
    { code: '6813', name: 'Cheltuieli de exploatare privind ajustarile pentru deprecierea imobilizarilor' },
    { code: '6814', name: 'Cheltuieli de exploatare privind ajustarile pentru deprecierea activelor circulante' },
    { code: '6817', name: 'Cheltuieli de exploatare privind ajustarile pentru deprecierea fondului comercial' },
    { code: '6818', name: 'Cheltuieli de exploatare privind ajustarile pentru deprecierea creantelor reprezentand avansuri acordate furnizorilor' },
    { code: '686', name: 'Cheltuieli financiare privind amortizarile, provizioanele si ajustarile pentru pierdere de valoare' },
    { code: '6861', name: 'Cheltuieli privind actualizarea provizioanelor' },
    { code: '6863', name: 'Cheltuieli financiare privind ajustarile pentru pierderea de valoare a imobilizarilor financiare' },
    { code: '6864', name: 'Cheltuieli financiare privind ajustarile pentru pierderea de valoare a activelor circulante' },
    { code: '6865', name: 'Cheltuieli financiare privind amortizarea diferentelor aferente titlurilor de stat' },
    { code: '6868', name: 'Cheltuieli financiare privind amortizarea primelor de rambursare a obligatiunilor si a altor datorii' },
    
    // 69. Cheltuieli cu impozitul pe profit si alte impozite
    { code: '691', name: 'Cheltuieli cu impozitul pe profit' },
    { code: '694', name: 'Cheltuieli cu impozitul pe profit rezultat din decontarile in cadrul grupului fiscal in domeniul impozitului pe profit' },
    { code: '695', name: 'Cheltuieli cu impozitul specific unor activitati' },
    { code: '697', name: 'Cheltuieli cu impozitul pe profit la nivelul impozitului minim pe cifra de afaceri' },
    { code: '698', name: 'Cheltuieli cu impozitul pe venit si cu alte impozite care nu apar in elementele de mai sus' },

    // Clasa 7 - Conturi de venituri
    
    // 70. Cifra de afaceri neta
    { code: '701', name: 'Venituri din vanzarea produselor finite, produselor agricole si a activelor biologice de natura stocurilor' },
    { code: '7015', name: 'Venituri din vanzarea produselor finite' },
    { code: '7017', name: 'Venituri din vanzarea produselor agricole' },
    { code: '7018', name: 'Venituri din vanzarea activelor biologice de natura stocurilor' },
    { code: '702', name: 'Venituri din vanzarea semifabricatelor' },
    { code: '703', name: 'Venituri din vanzarea produselor reziduale' },
    { code: '704', name: 'Venituri din servicii prestate' },
    { code: '705', name: 'Venituri din studii si cercetari' },
    { code: '706', name: 'Venituri din redevente, locatii de gestiune si chirii' },
    { code: '707', name: 'Venituri din vanzarea marfurilor' },
    { code: '708', name: 'Venituri din activitati diverse' },
    { code: '709', name: 'Reduceri comerciale acordate' },
    
    // 71. Venituri aferente costului productiei in curs de executie
    { code: '711', name: 'Venituri aferente costurilor stocurilor de produse' },
    { code: '712', name: 'Venituri aferente costurilor serviciilor in curs de executie' },
    
    // 72. Venituri din productia de imobilizari
    { code: '721', name: 'Venituri din productia de imobilizari necorporale' },
    { code: '722', name: 'Venituri din productia de imobilizari corporale' },
    { code: '725', name: 'Venituri din productia de investitii imobiliare' },
    
    // 74. Venituri din subventii de exploatare
    { code: '741', name: 'Venituri din subventii de exploatare' },
    { code: '7411', name: 'Venituri din subventii de exploatare aferente cifrei de afaceri' },
    { code: '7412', name: 'Venituri din subventii de exploatare pentru materii prime si materiale' },
    { code: '7413', name: 'Venituri din subventii de exploatare pentru alte cheltuieli externe' },
    { code: '7414', name: 'Venituri din subventii de exploatare pentru plata personalului' },
    { code: '7415', name: 'Venituri din subventii de exploatare pentru asigurari si protectie sociala' },
    { code: '7416', name: 'Venituri din subventii de exploatare pentru alte cheltuieli de exploatare' },
    { code: '7417', name: 'Venituri din subventii de exploatare in caz de calamitati si alte evenimente similare' },
    { code: '7418', name: 'Venituri din subventii de exploatare pentru dobanda datorata' },
    { code: '7419', name: 'Venituri din subventii de exploatare aferente altor venituri' },
    
    // 75. Alte venituri din exploatare
    { code: '751', name: 'Venituri din operatiuni de fiducie' },
    { code: '7511', name: 'Venituri ocazionate de constituirea fiduciei' },
    { code: '7512', name: 'Venituri din derularea operatiunilor de fiducie' },
    { code: '7513', name: 'Venituri din lichidarea operatiunilor de fiducie' },
    { code: '754', name: 'Venituri din creante reactivate si debitori diversi' },
    { code: '755', name: 'Venituri din reevaluarea imobilizarilor corporale' },
    { code: '758', name: 'Alte venituri din exploatare' },
    { code: '7581', name: 'Venituri din despagubiri, amenzi si penalitati' },
    { code: '7582', name: 'Venituri din donatii primite' },
    { code: '7583', name: 'Venituri din vanzarea activelor si alte operatiuni de capital' },
    { code: '7584', name: 'Venituri din subventii pentru investitii' },
    { code: '7586', name: 'Venituri reprezentand transferuri cuvenite in baza unor acte normative speciale' },
    { code: '7588', name: 'Alte venituri din exploatare' },
    
    // 76. Venituri financiare
    { code: '761', name: 'Venituri din imobilizari financiare' },
    { code: '7611', name: 'Venituri din actiuni detinute la entitatile afiliate' },
    { code: '7612', name: 'Venituri din actiuni detinute la entitati asociate' },
    { code: '7613', name: 'Venituri din actiuni detinute la entitati controlate in comun' },
    { code: '7615', name: 'Venituri din alte imobilizari financiare' },
    { code: '762', name: 'Venituri din investitii financiare pe termen scurt' },
    { code: '764', name: 'Venituri din investitii financiare cedate' },
    { code: '7641', name: 'Venituri din imobilizari financiare cedate' },
    { code: '7642', name: 'Castiguri din investitii pe termen scurt cedate' },
    { code: '765', name: 'Venituri din diferente de curs valutar' },
    { code: '7651', name: 'Diferente favorabile de curs valutar legate de elementele monetare exprimate in valuta' },
    { code: '7652', name: 'Diferente favorabile de curs valutar din evaluarea elementelor monetare care fac parte din investitia neta intr-o entitate straina' },
    { code: '766', name: 'Venituri din dobanzi' },
    { code: '767', name: 'Venituri din sconturi obtinute' },
    { code: '768', name: 'Alte venituri financiare' },
    
    // 78. Venituri din provizioane, amortizari si ajustari pentru depreciere sau pierdere de valoare
    { code: '781', name: 'Venituri din provizioane si ajustari pentru depreciere privind activitatea de exploatare' },
    { code: '7812', name: 'Venituri din provizioane' },
    { code: '7813', name: 'Venituri din ajustari pentru deprecierea imobilizarilor' },
    { code: '7814', name: 'Venituri din ajustari pentru deprecierea activelor circulante' },
    { code: '7815', name: 'Venituri din fondul comercial negativ' },
    { code: '7818', name: 'Venituri din ajustari pentru deprecierea creantelor reprezentand avansuri acordate furnizorilor' },
    { code: '786', name: 'Venituri financiare din amortizari si ajustari pentru pierdere de valoare' },
    { code: '7863', name: 'Venituri financiare din ajustari pentru pierderea de valoare a imobilizarilor financiare' },
    { code: '7864', name: 'Venituri financiare din ajustari pentru pierderea de valoare a activelor circulante' },
    { code: '7865', name: 'Venituri financiare din amortizarea diferentelor aferente titlurilor de stat' },
    
    // 79. Venituri din impozitul pe profit
    { code: '794', name: 'Venituri din impozitul pe profit rezultat din decontarile in cadrul grupului fiscal in domeniul impozitului pe profit' },

    // Clasa 8 - Conturi speciale
    
    // 80. Conturi in afara bilantului
    { code: '801', name: 'Angajamente acordate' },
    { code: '8011', name: 'Giruri si garantii acordate' },
    { code: '8018', name: 'Alte angajamente acordate' },
    { code: '802', name: 'Angajamente primite' },
    { code: '8021', name: 'Giruri si garantii primite' },
    { code: '8028', name: 'Alte angajamente primite' },
    { code: '803', name: 'Alte conturi in afara bilantului' },
    { code: '8031', name: 'Imobilizari corporale primite cu chirie sau in baza altor contracte similare' },
    { code: '8032', name: 'Valori materiale primite spre prelucrare sau reparare' },
    { code: '8033', name: 'Valori materiale primite in pastrare sau custodie' },
    { code: '8034', name: 'Debitori scosi din activ, urmariti in continuare' },
    { code: '8035', name: 'Stocuri de natura obiectelor de inventar date in folosinta' },
    { code: '8036', name: 'Redevente, locatii de gestiune, chirii si alte datorii asimilate' },
    { code: '8037', name: 'Efecte scontate neajunse la scadenta' },
    { code: '8038', name: 'Bunuri primite in administrare, concesiune, cu chirie si alte bunuri similare' },
    { code: '8039', name: 'Alte valori in afara bilantului' },
    { code: '804', name: 'Certificate verzi' },
    { code: '805', name: 'Dobanzi aferente contractelor de leasing si altor contracte asimilate, neajunse la scadenta' },
    { code: '8051', name: 'Dobanzi de platit' },
    { code: '8052', name: 'Dobanzi de incasat' },
    { code: '806', name: 'Certificate de emisii de gaze cu efect de sera' },
    { code: '807', name: 'Active contingente' },
    { code: '808', name: 'Datorii contingente' },
    { code: '809', name: 'Creante preluate prin cesionare' },
    
    // 89. Bilant
    { code: '891', name: 'Bilant de deschidere' },
    { code: '892', name: 'Bilant de inchidere' },

    // Clasa 9 - Conturi de gestiune
    
    // 90. Decontari interne
    { code: '901', name: 'Decontari interne privind cheltuielile' },
    { code: '902', name: 'Decontari interne privind productia obtinuta' },
    { code: '903', name: 'Decontari interne privind diferentele de pret' },
    
    // 92. Conturi de calculatie
    { code: '921', name: 'Cheltuielile activitatii de baza' },
    { code: '922', name: 'Cheltuielile activitatilor auxiliare' },
    { code: '923', name: 'Cheltuieli indirecte de productie' },
    { code: '924', name: 'Cheltuieli generale de administratie' },
    { code: '925', name: 'Cheltuieli de desfacere' },
    
    // 93. Costul productiei
    { code: '931', name: 'Costul productiei obtinute' },
    { code: '933', name: 'Costul productiei in curs de executie' }
];