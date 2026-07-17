// India geography master — states → districts, and SIDBI branch offices per state.
// Representative real data. Full pincode/district masters can replace these maps
// (keep the same shape: DISTRICTS[state] = [names], SIDBI_BRANCHES[state] = [names]).

export const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
]

export const DISTRICTS = {
  'Andhra Pradesh': ['Anantapur', 'Chittoor', 'East Godavari', 'Guntur', 'Kadapa', 'Krishna', 'Kurnool', 'Nellore', 'Prakasam', 'Srikakulam', 'Visakhapatnam', 'Vizianagaram', 'West Godavari', 'Tirupati', 'Kakinada'],
  'Assam': ['Barpeta', 'Cachar', 'Dibrugarh', 'Dima Hasao', 'Goalpara', 'Jorhat', 'Kamrup', 'Nagaon', 'Sonitpur', 'Tinsukia'],
  'Bihar': ['Bhagalpur', 'Darbhanga', 'Gaya', 'Muzaffarpur', 'Nalanda', 'Nawada', 'Patna', 'Purnia', 'Rohtas', 'Vaishali'],
  'Chhattisgarh': ['Bilaspur', 'Durg', 'Korba', 'Raigarh', 'Raipur', 'Rajnandgaon'],
  'Delhi': ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 'North West Delhi', 'Shahdara', 'South Delhi', 'South West Delhi', 'West Delhi'],
  'Goa': ['North Goa', 'South Goa'],
  'Gujarat': ['Ahmedabad', 'Amreli', 'Anand', 'Bharuch', 'Bhavnagar', 'Dahod', 'Gandhinagar', 'Jamnagar', 'Junagadh', 'Kutch', 'Mahesana', 'Morbi', 'Navsari', 'Rajkot', 'Surat', 'Surendranagar', 'Vadodara', 'Valsad'],
  'Haryana': ['Ambala', 'Faridabad', 'Gurugram', 'Hisar', 'Karnal', 'Panipat', 'Rohtak', 'Sonipat', 'Yamunanagar'],
  'Himachal Pradesh': ['Bilaspur', 'Kangra', 'Kullu', 'Mandi', 'Shimla', 'Solan', 'Una'],
  'Jharkhand': ['Bokaro', 'Dhanbad', 'East Singhbhum', 'Hazaribagh', 'Ranchi', 'Saraikela Kharsawan'],
  'Karnataka': ['Bagalkot', 'Ballari', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban', 'Davanagere', 'Dharwad', 'Hubballi', 'Kalaburagi', 'Mandya', 'Mysuru', 'Shivamogga', 'Tumakuru', 'Udupi'],
  'Kerala': ['Alappuzha', 'Ernakulam', 'Kannur', 'Kollam', 'Kottayam', 'Kozhikode', 'Malappuram', 'Palakkad', 'Thiruvananthapuram', 'Thrissur'],
  'Madhya Pradesh': ['Bhopal', 'Dewas', 'Gwalior', 'Indore', 'Jabalpur', 'Sagar', 'Satna', 'Ujjain'],
  'Maharashtra': ['Ahmednagar', 'Aurangabad', 'Kolhapur', 'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nashik', 'Pune', 'Sangli', 'Solapur', 'Thane'],
  'Odisha': ['Balasore', 'Cuttack', 'Ganjam', 'Khordha', 'Puri', 'Sambalpur', 'Sundargarh'],
  'Punjab': ['Amritsar', 'Bathinda', 'Jalandhar', 'Ludhiana', 'Mohali', 'Patiala', 'Sangrur'],
  'Rajasthan': ['Ajmer', 'Alwar', 'Bhilwara', 'Bikaner', 'Jaipur', 'Jodhpur', 'Kota', 'Udaipur'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Dindigul', 'Erode', 'Kanchipuram', 'Karur', 'Madurai', 'Namakkal', 'Salem', 'Tiruppur', 'Tiruchirappalli', 'Vellore'],
  'Telangana': ['Hyderabad', 'Karimnagar', 'Khammam', 'Medak', 'Nalgonda', 'Nizamabad', 'Rangareddy', 'Warangal'],
  'Uttar Pradesh': ['Agra', 'Aligarh', 'Bareilly', 'Ghaziabad', 'Gorakhpur', 'Kanpur Nagar', 'Lucknow', 'Meerut', 'Moradabad', 'Noida (Gautam Buddh Nagar)', 'Varanasi'],
  'Uttarakhand': ['Dehradun', 'Haridwar', 'Nainital', 'Udham Singh Nagar'],
  'West Bengal': ['Bardhaman', 'Darjeeling', 'Howrah', 'Hooghly', 'Kolkata', 'Malda', 'Murshidabad', 'Nadia', 'North 24 Parganas', 'South 24 Parganas'],
  'Chandigarh': ['Chandigarh'],
  'Jammu and Kashmir': ['Anantnag', 'Baramulla', 'Jammu', 'Srinagar'],
  'Puducherry': ['Karaikal', 'Mahe', 'Puducherry', 'Yanam'],
}

// States not enumerated above fall back to a single "Other district" entry.
export const districtsOf = (state) => DISTRICTS[state] || (state ? ['Other'] : [])

export const SIDBI_BRANCHES = {
  'Andhra Pradesh': ['SIDBI Visakhapatnam', 'SIDBI Vijayawada', 'SIDBI Guntur', 'SIDBI Tirupati'],
  'Bihar': ['SIDBI Patna', 'SIDBI Muzaffarpur'],
  'Delhi': ['SIDBI New Delhi', 'SIDBI Okhla'],
  'Gujarat': ['SIDBI Ahmedabad', 'SIDBI Surat', 'SIDBI Rajkot', 'SIDBI Vadodara'],
  'Haryana': ['SIDBI Gurugram', 'SIDBI Faridabad', 'SIDBI Panipat'],
  'Karnataka': ['SIDBI Bengaluru', 'SIDBI Hubballi', 'SIDBI Mysuru'],
  'Kerala': ['SIDBI Kochi', 'SIDBI Thiruvananthapuram'],
  'Madhya Pradesh': ['SIDBI Bhopal', 'SIDBI Indore'],
  'Maharashtra': ['SIDBI Mumbai', 'SIDBI Pune', 'SIDBI Nagpur', 'SIDBI Nashik'],
  'Punjab': ['SIDBI Ludhiana', 'SIDBI Jalandhar', 'SIDBI Amritsar'],
  'Rajasthan': ['SIDBI Jaipur', 'SIDBI Jodhpur'],
  'Tamil Nadu': ['SIDBI Chennai', 'SIDBI Coimbatore', 'SIDBI Madurai', 'SIDBI Tiruppur'],
  'Telangana': ['SIDBI Hyderabad', 'SIDBI Warangal'],
  'Uttar Pradesh': ['SIDBI Lucknow', 'SIDBI Kanpur', 'SIDBI Noida', 'SIDBI Agra'],
  'West Bengal': ['SIDBI Kolkata', 'SIDBI Siliguri'],
}

export const sidbiBranchesOf = (state) => SIDBI_BRANCHES[state] || (state ? ['SIDBI Regional Office'] : [])

// SDEs available for appraisal (Select SDE dropdown).
export const SDE_OFFICERS = [
  'Rajesh Menon — SIDBI Coimbatore',
  'Priya Nair — SIDBI Chennai',
  'Amit Deshpande — SIDBI Pune',
  'Sunita Rao — SIDBI Bengaluru',
  'Vikram Shah — SIDBI Ahmedabad',
]
