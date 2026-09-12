import email, glob, re

def parse_brenda_email(raw_body):
    body = raw_body
    # Strip signature
    body = re.sub(r'--\s*\n.*', '', body, flags=re.S)
    lines = [l.strip() for l in body.splitlines()]
    
    schedule = []
    current_day = None
    collecting_role = None
    
    date_regex = re.compile(
        r'^(?:\*\s*)?(?:Mon|Tue|Wed|Thu|Thur|Thurs|Fri|Sat|Sun)(?:\s*-\s*|\s+)(?:Jan|Feb|Mar|Apr|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|Nov|Dec)\s+\d+.*',
        re.I
    )
    
    for line in lines:
        if not line:
            continue
        clean = re.sub(r'[\*\#\_]+', '', line).strip()
        if not clean:
            continue
            
        if date_regex.match(clean) and not clean.lower().startswith('meal prep'):
            if current_day:
                schedule.append(current_day)
            is_brunch = 'brunch' in clean.lower()
            current_day = {
                'dateLabel': clean,
                'mealType': 'BRUNCH' if is_brunch else 'DINNER',
                'cooks': [],
                'cleaners': [],
                'isNoMeal': False,
            }
            collecting_role = 'COOKS'
            continue
            
        if not current_day:
            continue
            
        if 'no community meal' in clean.lower():
            current_day['isNoMeal'] = True
            collecting_role = None
            continue
            
        if re.match(r'^Cleaning:\s*', clean, re.I):
            collecting_role = 'CLEANERS'
            names_part = re.sub(r'^Cleaning:\s*', '', clean, flags=re.I).strip()
            if names_part:
                names = [n.strip() for n in re.split(r'[,;&\+]', names_part) if n.strip()]
                current_day['cleaners'].extend(names)
            continue
            
        if collecting_role == 'COOKS':
            if clean.lower().startswith('hi ') or 'schedule for' in clean.lower() or clean.lower().startswith('on '):
                continue
            names = [n.strip() for n in re.split(r'[,;&\+]', clean) if n.strip()]
            for n in names:
                if n and not any(n.lower().startswith(x) for x in ['http', '>', 'for critical', 'you received']):
                    current_day['cooks'].append(n)
            continue
            
        if collecting_role == 'CLEANERS':
            names = [n.strip() for n in re.split(r'[,;&\+]', clean) if n.strip()]
            for n in names:
                if n and not any(n.lower().startswith(x) for x in ['http', '>', 'for critical', 'you received']):
                    current_day['cleaners'].append(n)
            continue

    if current_day:
        schedule.append(current_day)
        
    return schedule

for path in sorted(glob.glob('data/historical/*.eml')):
    with open(path, 'rb') as f:
        msg = email.message_from_binary_file(f)
        body = ''
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == 'text/plain':
                    body = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                    break
        else:
            body = msg.get_payload(decode=True).decode('utf-8', errors='ignore')
            
    sched = parse_brenda_email(body)
    active_days = [d for d in sched if not d['isNoMeal']]
    no_meal_days = [d for d in sched if d['isNoMeal']]
    print(f"📧 {path.split('/')[-1]}")
    print(f"   Total Days: {len(sched)} (Active: {len(active_days)}, No Meal: {len(no_meal_days)})")
    for d in sched[:3]:
        status = "(NO MEAL)" if d['isNoMeal'] else f"Cooks: {', '.join(d['cooks'])} | Cleaners: {', '.join(d['cleaners'])}"
        print(f"   • {d['dateLabel'].ljust(25)} -> {status}")
    print()
