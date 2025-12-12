import React, { useState } from 'react';
import { format, isToday, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Trash2, Clock } from 'lucide-react';
import { cn } from '../utils/cn';
import { Card, EmptyState, Button, Badge } from '../components/UI';
import { EventModal } from '../components/EventModal';
import { useCalendar } from '../hooks/useCalendar';
import { PublicHoliday, UserEvent } from '../types';
import { eventService } from '../services/eventService';

interface CalendarViewProps {
  holidays: PublicHoliday[];
  events: UserEvent[];
  onAddEvent: (event: Omit<UserEvent, 'id' | 'createdAt'>) => void;
  onDeleteEvent: (id: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  holidays,
  events,
  onAddEvent,
  onDeleteEvent,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const {
    currentDate,
    selectedDate,
    setSelectedDate,
    changeMonth,
    goToToday,
    daysInMonth,
    paddingDays,
    selectedDayHoliday,
    getHolidayForDate,
  } = useCalendar({ holidays });

  return (
    <div className="space-y-4 p-4 min-h-screen bg-slate-50">
      {/* Calendar Card */}
      <div className="bg-white rounded-3xl shadow-sm shadow-slate-200 border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-50/50 p-4 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeMonth(-1)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-sm"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => changeMonth(1)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-sm"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <h2 className="text-base font-bold text-slate-800 tracking-tight">
            {format(currentDate, 'MMMM yyyy')}
          </h2>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-3 text-xs font-bold bg-white border border-slate-200 shadow-sm text-blue-600 hover:bg-blue-50"
            onClick={goToToday}
          >
            Today
          </Button>
        </div>

        <div className="p-4">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 mb-3">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wide py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-y-3 gap-x-1 justify-items-center">
            {paddingDays.map((_, i) => (
              <div key={`pad-${i}`} className="w-9 h-9" />
            ))}

            {daysInMonth.map((day) => {
              const holiday = getHolidayForDate(day);
              const dayEvents = eventService.getEventsForDate(events, format(day, 'yyyy-MM-dd'));
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);
              const hasEvents = dayEvents.length > 0;

              return (
                <button
                  key={day.toString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    'w-9 h-10 flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-all duration-200 relative touch-manipulation',
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-105 z-10'
                      : 'text-slate-700 hover:bg-slate-50',
                    !isSelected &&
                      isTodayDate &&
                      'text-blue-600 bg-blue-50 ring-1 ring-inset ring-blue-100 font-bold',
                    !isSelected && holiday && 'bg-purple-50 text-purple-700 font-bold'
                  )}
                >
                  <span>{format(day, 'd')}</span>

                  {/* Dots */}
                  <div className="flex gap-0.5 mt-0.5 h-1 items-center">
                    {/* Holiday Dot */}
                    {holiday && (
                      <span
                        className={cn(
                          'w-1 h-1 rounded-full',
                          isSelected ? 'bg-white' : 'bg-purple-500'
                        )}
                      />
                    )}
                    {/* Event Dot */}
                    {hasEvents && (
                      <span
                        className={cn(
                          'w-1 h-1 rounded-full',
                          isSelected ? 'bg-white' : 'bg-green-500'
                        )}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Day Info */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-4">
        <div className="flex items-baseline justify-between px-1 mb-3">
          <h2 className="text-sm font-bold text-slate-800">
            {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEEE')}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{format(selectedDate, 'MMM do')}</span>
            <Button
              size="sm"
              className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus size={14} className="mr-1" />
              Add
            </Button>
          </div>
        </div>

        {/* Holiday Card */}
        {selectedDayHoliday && (
          <Card className="flex gap-4 p-4 items-start mb-3 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 border-l-4 border-l-orange-600 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-md text-lg">
              🇱🇰
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-orange-900 text-sm">{selectedDayHoliday.localName}</h3>
              {selectedDayHoliday.description && (
                <p className="text-xs text-orange-700 mt-1 leading-relaxed">
                  {selectedDayHoliday.description}
                </p>
              )}
              <Badge className="mt-2 bg-white text-orange-700 border-orange-300">
                Public Holiday
              </Badge>
            </div>
          </Card>
        )}

        {/* User Events */}
        {eventService.getEventsForDate(events, format(selectedDate, 'yyyy-MM-dd')).map((event) => (
          <Card
            key={event.id}
            className="flex gap-4 p-4 items-start mb-3 border-l-4 shadow-sm"
            style={{ borderLeftColor: event.color || '#3B82F6' }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white shadow-md"
              style={{ backgroundColor: event.color || '#3B82F6' }}
            >
                <CalendarIcon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-900 text-sm">{event.title}</h3>
              {event.description && (
                <p className="text-xs text-slate-600 mt-1">{event.description}</p>
              )}
              {(event.startTime || event.endTime) && (
                <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                  <Clock size={12} />
                  <span>
                    {event.startTime || ''}
                    {event.startTime && event.endTime && ' - '}
                    {event.endTime || ''}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => onDeleteEvent(event.id)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 text-red-500 transition-colors"
              title="Delete event"
            >
              <Trash2 size={16} />
            </button>
          </Card>
        ))}

        {/* Empty State */}
        {!selectedDayHoliday &&
          eventService.getEventsForDate(events, format(selectedDate, 'yyyy-MM-dd')).length ===
            0 && <EmptyState icon={CalendarIcon} message="No events on this day." />}
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={onAddEvent}
        selectedDate={selectedDate}
      />
    </div>
  );
};
