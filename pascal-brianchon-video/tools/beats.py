# beats → seconds: python3 tools/beats.py 30.5,31.6 → "22.980,23.791"
import sys
print(','.join(f'{0.489 + 0.73742 * float(x):.3f}' for x in sys.argv[1].split(',')))
