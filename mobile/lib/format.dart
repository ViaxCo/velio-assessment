const _symbols = {'NGN': '₦', 'USD': r'$', 'GBP': '£', 'EUR': '€'};
const _weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

String formatPrice(int priceMinor, String currency) {
  if (priceMinor == 0) return 'Free';
  final whole = (priceMinor / 100).round().toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+$)'), (_) => ',');
  return '${_symbols[currency] ?? '$currency '}$whole';
}

String formatDate(DateTime date) {
  final minutes = date.minute.toString().padLeft(2, '0');
  return '${_weekdays[date.weekday - 1]} ${date.day} ${_months[date.month - 1]}, ${date.hour}:$minutes';
}
