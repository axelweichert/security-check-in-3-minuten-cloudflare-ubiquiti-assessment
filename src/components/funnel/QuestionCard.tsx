import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Question } from '@/lib/questions';
interface QuestionCardProps {
  question: Question;
  value: string | string[];
  onChange: (value: string | string[]) => void;
}
export function QuestionCard({ question, value, onChange }: QuestionCardProps) {
  const { t } = useTranslation();
  const renderInput = () => {
    switch (question.type) {
      case 'radio':
        return (
          <RadioGroup onValueChange={onChange} value={value as string}>
            <div className="space-y-3">
              {question.options?.map((option) => (
                <div key={option.value} className="flex items-center space-x-3">
                  <RadioGroupItem value={option.value} id={`${question.id}-${option.value}`} />
                  <Label htmlFor={`${question.id}-${option.value}`} className="font-normal">{t(option.labelKey)}</Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        );
      case 'select':
        return (
          <Select onValueChange={onChange} value={value as string}>
            <SelectTrigger>
              <SelectValue placeholder={t('app.select_option')} />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'checkbox': {
        const handleCheckboxChange = (checked: boolean, optionValue: string) => {
          const currentValues = Array.isArray(value) ? value : [];
          if (checked) {
            onChange([...currentValues, optionValue]);
          } else {
            onChange(currentValues.filter((v) => v !== optionValue));
          }
        };
        return (
          <div className="space-y-3">
            {question.options?.map((option) => (
              <div key={option.value} className="flex items-center space-x-3">
                <Checkbox
                  id={`${question.id}-${option.value}`}
                  checked={Array.isArray(value) && value.includes(option.value)}
                  onCheckedChange={(checked) => handleCheckboxChange(!!checked, option.value)}
                />
                <Label htmlFor={`${question.id}-${option.value}`} className="font-normal">{t(option.labelKey)}</Label>
              </div>
            ))}
          </div>
        );
      }
      case 'text':
      case 'email':
      case 'tel':
        return (
            <Input
                type={question.type}
                value={value as string || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={t(question.labelKey)}
            />
        );
      default:
        return null;
    }
  };
  // For contact fields, don't wrap in a card, just render the input.
  if (question.level === 5 && (question.type === 'text' || question.type === 'email' || question.type === 'tel' || question.type === 'select')) {
    return renderInput();
  }
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg font-medium">{t(question.labelKey)}</CardTitle>
      </CardHeader>
      <CardContent>{renderInput()}</CardContent>
    </Card>
  );
}