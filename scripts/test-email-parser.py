import email, glob, re, json

def parse_brenda_email(raw_body):
    # Strip quoted-printable artifacts, HTML, and email footers
    body = raw_body
    body = re.sub(r'--\s*\n.*', '', body, flags=re.S) # strip email signature / footer
    lines = [l.strip() for l in body.splitlines()]
    
    schedule = []
    current_day = None
    collecting_role = None # 'COOKS' or 'CLEANERS'
    
    # Regex to match date lines:
    # e.g. "*Thur Sept 3*", "*Sun Sept 6 - Dinner*", "Sun Sept 13 - Brunch", "*Mon - Sept 14*", "Mon Jun 1 - Dinner"
    date_regex = re.compile(
        r'^(?:\*\s*)?(?:Mon|Tue|Wed|Thu|Thur|Thurs|Fri|Sat|Sun)(?:\s*-\s*|\s+)(?:Jan|Feb|Mar|Apr|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|Nov|Dec)\s+\d+.*',
        re.I
    )
    
    for line in lines:
        if not line:
            continue
            
        # Clean markdown asterisks/underscores
        clean = re.sub(r'[\*\#\_]+', '', line).strip()
        if not clean:
            continue
            
        # Check if line is a date header
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
                'notes': ''
            }
            collecting_role = 'COOKS'
            continue
            
        if not current_day:
            continue
            
        # Check for "No Community Meal"
        if 'no community meal' in clean.lower():
            current_day['isNoMeal'] = True
            current_day['notes'] = 'No Community Meal'
            collecting_role = None
            continue
            
        # Check for "Cleaning:" header
        if re.match(r'^Cleaning:\s*', clean, re.I):
            collecting_role = 'CLEANERS'
            names_part = re.sub(r'^Cleaning:\s*', '', clean, flags=re.I).strip()
            if names_part:
                names = [n.strip() for n in re.split(r'[,;&\+]', names_part) if n.strip()]
                current_day['cleaners'].extend(names)
            continue
            
        # If collecting cooks
        if collecting_role == 'COOKS':
            # Skip noise or greetings
            if clean.lower().startswith('hi ') or 'schedule for' in clean.lower():
                continue
            # Single name or comma-separated names
            names = [n.strip() for n in re.split(r'[,;&\+]', clean) if n.strip()]
            for n in names:
                if n and not any(n.lower().startswith(x) for x in ['http', '>', 'for critical', 'you received']):
                    current_day['cooks'].append(n)
            continue
            
        # If collecting cleaners
        if collecting_role == 'CLEANERS':
            names = [n.strip() for n in re.split(r'[,;&\+]', clean) if n.strip()]
            for n in names:
                if n and not any(n.lower().startswith(x) for x in ['http', '>', 'for critical', 'you received']):
                    current_day['cleaners'].append(n)
            continue

    if current_day:
        schedule.append(current_day)
        
    return schedule

# Test on September
with open('data/historical/[vancoho-residents] MEAL SCHEDULE - September 1 - September 30 - Please Note Your Dates.eml', 'rb') as f:
    msg = email.message_from_binary_file(f)
    body = ''
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == 'text/plain':
                body = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                break
    else:
        body = msg.get_payload(decode=True).decode('utf-8', errors='ignore')
        
sept_sched = parse_brenda_email(body)
print("=== PARSED SEPTEMBER SCHEDULE ===")
for d in sept_sched:
    status = "(NO MEAL)" if d['isNoMeal'] else f"Cooks: {', '.join(d['cooks'])} | Cleaners: {', '.join(d['cleaners'])}"
    print(f"• {d['dateLabel'].ljust(25)} -> {status}")
