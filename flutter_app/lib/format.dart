const _weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

String formatBriefingDate(String isoDate, [DateTime? now]) {
  final parts = isoDate.split("-");
  if (parts.length != 3) return isoDate;
  final year = int.tryParse(parts[0]) ?? 0;
  final month = int.tryParse(parts[1]) ?? 0;
  final day = int.tryParse(parts[2]) ?? 0;
  final date = DateTime.utc(year, month, day);
  final weekday = _weekdays[date.weekday - 1];
  final clock = (now ?? DateTime.now()).toUtc().add(const Duration(hours: 8));
  final prefix = year == clock.year ? "" : "$year年";
  return "$prefix$month月$day日 $weekday";
}
