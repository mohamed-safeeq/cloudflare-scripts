const BASE_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';

export async function getContactIdByPhone(phone, token) {
  const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
  const url = `${BASE_URL}/search`;

  const payload = {
    filterGroups: [{
      filters: [{
        propertyName: 'phone',
        operator: 'EQ',
        value: formattedPhone,
      }],
    }],
    properties: ['phone'],
    limit: 1,
  };

  console.log(`Searching contact with phone: ${formattedPhone}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error(`Failed to fetch contact for phone: ${formattedPhone} (Status: ${res.status})`);
    return null;
  }

  const data = await res.json();
  const contactId = data?.results?.[0]?.id;

  if (contactId) {
    console.log(`Contact found: ${contactId}`);
  } else {
    console.log(`No contact found for phone: ${formattedPhone}`);
  }

  return contactId || null;
}

export async function updateReplyNeeded(contactId, value, token, propertyName) {
  const url = `${BASE_URL}/${contactId}`;
  const payload = {
    properties: {
      [propertyName]: value,
    },
  };

  console.log(`Updating contact ${contactId}: ${propertyName} = ${value}`);

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error(`Failed to update contact ${contactId} (Status: ${res.status})`);
  } else {
    console.log(`Contact ${contactId} updated successfully`);
  }
}
