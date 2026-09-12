import zipfile, xml.etree.ElementTree as ET
import email, glob, re, json, datetime

ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def parse_excel_date(serial):
    try:
        d = datetime.date(1899, 12, 30) + datetime.timedelta(days=int(float(serial)))
        return d.strftime("%Y-%m-%d"), d.strftime("%b %-d")
    except:
        return None, None

def export_parsed_json():
    with zipfile.ZipFile('data/historical/Sample Only - Meals Prep Signup.xlsx') as z:
        sst = []
        if 'xl/sharedStrings.xml' in z.namelist():
            sst_xml = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in sst_xml.findall('.//main:si', ns):
                t = si.find('.//main:t', ns)
                sst.append(t.text if t is not None and t.text is not None else ''.join([x.text for x in si.findall('.//main:t', ns) if x.text]))
                
        wb_xml = ET.fromstring(z.read('xl/workbook.xml'))
        sheets = wb_xml.findall('.//main:sheet', ns)
        rels_xml = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        
        all_months = {}
        for sh in sheets:
            tab_name = sh.attrib['name']
            rId = sh.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
            target = [r.attrib['Target'] for r in rels_xml if r.attrib['Id'] == rId][0]
            sheet_path = 'xl/' + target if not target.startswith('xl/') else target
            
            sheet_xml = ET.fromstring(z.read(sheet_path))
            rows = sheet_xml.findall('.//main:row', ns)
            
            grid = {}
            max_r, max_c = 0, 0
            for row in rows:
                r_idx = int(row.attrib['r'])
                max_r = max(max_r, r_idx)
                for c in row.findall('.//main:c', ns):
                    ref = c.attrib['r']
                    col_letters = re.match(r'([A-Z]+)', ref).group(1)
                    col_idx = 0
                    for ch in col_letters:
                        col_idx = col_idx * 26 + (ord(ch) - ord('A') + 1)
                    max_c = max(max_c, col_idx)
                    
                    t_type = c.attrib.get('t')
                    v = c.find('main:v', ns)
                    val = v.text if v is not None else ''
                    if t_type == 's' and val.isdigit():
                        val = sst[int(val)]
                    grid[(r_idx, col_idx)] = str(val).strip()
            
            date_columns = []
            for c in range(3, max_c + 1):
                day_name = grid.get((1, c), '')
                note_or_type = grid.get((2, c), '')
                serial = grid.get((3, c), '')
                if not serial or not re.match(r'^\d+(\.\d+)?$', serial):
                    continue
                date_iso, date_short = parse_excel_date(serial)
                if not date_iso:
                    continue
                    
                is_brunch = 'brunch' in note_or_type.lower() or 'brunch' in day_name.lower()
                meal_type = 'BRUNCH' if is_brunch else 'DINNER'
                date_label = f"{date_short} ({day_name[:3]}{', Brunch' if is_brunch else ''})"
                
                date_columns.append({
                    'col_idx': c,
                    'date_key': date_iso,
                    'date_label': date_label,
                    'day_of_week': day_name,
                    'meal_type': meal_type,
                    'note': note_or_type if note_or_type and note_or_type.lower() not in ['dinner', 'brunch'] else None,
                    'target_cooks': 2 if is_brunch else 3,
                    'target_cleans': 2 if is_brunch else 3,
                })
                
            members = []
            for r in range(4, max_r + 1):
                name = grid.get((r, 1), '')
                if not name or any(x in name.lower() for x in ['total', 'sum', 'count', 'average', 'legend', 'notes']):
                    continue
                clean_name = re.sub(r'[\#\*]+', '', name).strip()
                notes = grid.get((r, 2), '')
                
                lower_notes = notes.lower()
                willing_2_cook = '2' in lower_notes and 'cook' in lower_notes
                same_day = 'same day' in lower_notes or 'cook & clean' in lower_notes or 'cook and clean' in lower_notes or 'an clean' in lower_notes
                
                cook_quota = 1
                clean_quota = 1
                if 'unable to participate' in lower_notes or 'out of town' in lower_notes or 'away' in lower_notes:
                    cook_quota = 0
                    clean_quota = 0
                if '2 for cooking' in lower_notes or 'cook 2' in lower_notes or '2 cook' in lower_notes:
                    cook_quota = 2
                if 'clean only' in lower_notes or '0 cook' in lower_notes or 'no cook' in lower_notes:
                    cook_quota = 0
                if '2 clean' in lower_notes or 'clean 2' in lower_notes or '2 cleans' in lower_notes:
                    clean_quota = 2
                if 'cook only' in lower_notes or '0 clean' in lower_notes or 'no clean' in lower_notes:
                    clean_quota = 0
                    
                avail = {}
                for dc in date_columns:
                    val = grid.get((r, dc['col_idx']), '').lower()
                    if val in ['y', 'yes', '1']:
                        avail[dc['date_label']] = 'AVAILABLE'
                    elif 'cook' in val:
                        avail[dc['date_label']] = 'COOK_ONLY'
                    elif 'clean' in val:
                        avail[dc['date_label']] = 'CLEAN_ONLY'
                    else:
                        avail[dc['date_label']] = 'UNAVAILABLE'
                        
                members.append({
                    'raw_name': name,
                    'name': clean_name,
                    'notes': notes,
                    'cook_quota': cook_quota,
                    'clean_quota': clean_quota,
                    'can_cook_clean_same_day': same_day,
                    'cook_team_size_pref': '2 regardless of meal type' if willing_2_cook else 'Dinner = 3, Brunch = 2',
                    'availability': avail,
                })
                
            all_months[tab_name] = {
                'tab_name': tab_name,
                'dates': date_columns,
                'members': members,
            }
            
        with open('data/historical/parsed_historical_archive.json', 'w') as f:
            json.dump(all_months, f, indent=2)
            
    # Parse emails
    email_schedules = {}
    for path in sorted(glob.glob('data/historical/*.eml')):
        with open(path, 'rb') as f:
            msg = email.message_from_binary_file(f)
            subj = msg['subject'] or ''
            
            m = re.search(r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)', subj, re.I)
            if not m:
                continue
            month_abbr = m.group(1).upper()
            if month_abbr == "JUN": month_abbr = "JUN"
            if month_abbr == "JUL": month_abbr = "JUL"
            if month_abbr == "AUG": month_abbr = "AUG"
            if month_abbr == "SEP": month_abbr = "SEP"
            
            body = ''
            if msg.is_multipart():
                for part in msg.walk():
                    if part.get_content_type() == 'text/plain':
                        body = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                        break
            else:
                body = msg.get_payload(decode=True).decode('utf-8', errors='ignore')
                
            lines = [l.strip() for l in body.splitlines() if l.strip()]
            days = []
            curr_day = None
            is_collecting_cooks = False
            
            for line in lines:
                clean_line = re.sub(r'[\*\#\_]+', '', line).strip()
                if re.match(r'^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+[A-Za-z]{3,}\s+\d+', clean_line, re.I):
                    if curr_day:
                        days.append(curr_day)
                    is_brunch = 'brunch' in clean_line.lower()
                    curr_day = {
                        'header': clean_line,
                        'is_no_meal': False,
                        'meal_type': 'BRUNCH' if is_brunch else 'DINNER',
                        'cooks': [],
                        'cleaners': [],
                    }
                    is_collecting_cooks = True
                    continue
                    
                if curr_day:
                    if 'no community meal' in clean_line.lower():
                        curr_day['is_no_meal'] = True
                        is_collecting_cooks = False
                        continue
                    if re.match(r'^Cleaning:\s*', clean_line, re.I):
                        is_collecting_cooks = False
                        names_part = re.sub(r'^Cleaning:\s*', '', clean_line, flags=re.I)
                        names = [n.strip() for n in re.split(r'[,;&\+]', names_part) if n.strip()]
                        curr_day['cleaners'].extend(names)
                        continue
                    if is_collecting_cooks:
                        if clean_line and not clean_line.startswith('>') and not clean_line.startswith('http'):
                            curr_day['cooks'].append(clean_line)
                    else:
                        if clean_line and not clean_line.startswith('>') and not clean_line.startswith('http'):
                            names = [n.strip() for n in re.split(r'[,;&\+]', clean_line) if n.strip()]
                            curr_day['cleaners'].extend(names)
                            
            if curr_day:
                days.append(curr_day)
                
            email_schedules[month_abbr] = {
                'subject': subj,
                'days': [d for d in days if not d['is_no_meal']],
            }
            
    with open('data/historical/parsed_emails.json', 'w') as f:
        json.dump(email_schedules, f, indent=2)

if __name__ == '__main__':
    export_parsed_json()
