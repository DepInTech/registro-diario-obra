import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClientResponseError } from 'pocketbase'

import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Layers,
  Plus,
  Pencil,
  Power,
  Save,
  ArrowLeft,
  Loader2,
  AlertCircle,
  X,
  FileSpreadsheet,
  ListChecks,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  FIELD_SHEET_CONFIG_GROUPS,
  COMPRESSOR_PARAM_ROWS,
  PRESET_DATE_KEYS,
  countConfiguredFields,
} from '@/lib/fieldSheetConfigMetadata'
import type { AreaConfigRecord } from '@/lib/fieldSheetConfigMetadata'
