
import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBarChart,
  RadialBar
} from 'recharts';
import {
  BarChart2,
  TrendingUp,
  Users,
  Award,
  BookOpen,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  BarChart3,
  AlertTriangle,
  WifiOff,
  RefreshCcw,
  AlertOctagon
} from 'lucide-react';
import { endpoints, getApiBase } from '@/api/client';
import { SubjectStats, FailureAnalysis, TopPerformer } from '@/types';
import { getBatchOptions } from '@/utils/batches';

const Analytics: React.FC = () => {
  const [semester, setSemester] = useState(5);
  const [batch, setBatch] = useState<string | undefined>(undefined);
  const [branch, setBranch] = useState<string | undefined>(undefined);
  const [branches, setBranches] = useState<string[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'horizontal' | 'pie' | 'line' | 'area' | 'radar' | 'radial'>('bar');
  const [trendChartType, setTrendChartType] = useState<'area' | 'line' | 'bar'>('area');
  const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([]);
  const [failureAnalysis, setFailureAnalysis] = useState<FailureAnalysis | null>(null);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const batchOpts = batch || branch ? { batch, branch } : undefined;
      // Parallel fetch to improve speed, but wrapped to handle global failure
      const [stats, failures, tops] = await Promise.all([
        endpoints.getSubjectStats(semester, batchOpts),
        endpoints.getFailureAnalysis(semester, batchOpts),
        endpoints.getTopPerformers(semester, undefined, 10, { ...(batchOpts || {}), rank_by: 'sgpa' })
      ]);
      setSubjectStats(stats);
      setFailureAnalysis(failures);
      setTopPerformers(tops);
    } catch (err: any) {
      console.error("Analytics fetch failed:", err);
      setError(err.message || "Unable to load analytics data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [semester, batch, branch]);

  useEffect(() => {
    endpoints
      .getBranches(batch)
      .then((res) => setBranches(res || []))
      .catch(() => setBranches([]));
    setBranch(undefined);
  }, [batch]);

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center animate-in fade-in">
        <div className="w-24 h-24 bg-rose-50 rounded-[2.5rem] flex items-center justify-center text-rose-500 mb-8">
          <WifiOff size={48} />
        </div>
        <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Analytics Offline</h2>
        <p className="text-slate-500 max-w-lg mx-auto mb-10 font-medium leading-relaxed">
          We encountered a connection error while trying to reach the analytics engine at <code className="bg-slate-100 px-1 rounded font-bold">{getApiBase()}</code>.
          Please verify your backend service is active.
        </p>
        <div className="flex gap-4">
          <button
            onClick={fetchAnalytics}
            className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
          >
            <RefreshCcw size={20} /> Reconnect Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Intelligence Hub</h2>
          <p className="text-slate-500 font-medium">Comparative analytics and student performance metrics.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
            <span className="pl-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Semester</span>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
              <button
                key={s}
                onClick={() => setSemester(s)}
                className={`w-10 h-10 rounded-xl font-bold transition-all ${semester === s ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
            <span className="pl-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Batch</span>
            <select
              className="h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
              value={batch || ''}
              onChange={(e) => setBatch(e.target.value ? e.target.value : undefined)}
            >
              <option value="">All</option>
              {getBatchOptions().map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
            <span className="pl-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Branch</span>
            <select
              className="h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
              value={branch || ''}
              onChange={(e) => setBranch(e.target.value ? e.target.value : undefined)}
            >
              <option value="">All</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card rounded-[2.5rem] p-8 min-h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-900">Pass Percentage by Subject</h3>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as 'bar' | 'horizontal' | 'pie' | 'line' | 'area' | 'radar' | 'radial')}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="bar">📊 Bar Chart</option>
              <option value="horizontal">📊 Horizontal Bar</option>
              <option value="line">📈 Line Chart</option>
              <option value="area">📉 Area Chart</option>
              <option value="pie">🥧 Pie Chart</option>
              <option value="radar">🎯 Radar Chart</option>
              <option value="radial">⭕ Radial Chart</option>
            </select>
          </div>
          <div className="h-[300px] flex-1">
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center bg-slate-50/50 rounded-2xl animate-pulse">
                <BarChart3 size={32} className="text-slate-200" />
              </div>
            ) : subjectStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'bar' ? (
                  <BarChart data={subjectStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="subject_code"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                      formatter={(value: any) => [`${value}%`, 'Pass Rate']}
                    />
                    <Bar dataKey="pass_percentage" radius={[8, 8, 0, 0]} barSize={40}>
                      {subjectStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.pass_percentage >= 70 ? '#6366f1' : entry.pass_percentage >= 40 ? '#f59e0b' : '#f43f5e'} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : chartType === 'horizontal' ? (
                  <BarChart data={subjectStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                      domain={[0, 100]}
                    />
                    <YAxis
                      type="category"
                      dataKey="subject_code"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                      formatter={(value: any) => [`${value}%`, 'Pass Rate']}
                    />
                    <Bar dataKey="pass_percentage" radius={[0, 8, 8, 0]} barSize={30}>
                      {subjectStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.pass_percentage >= 70 ? '#6366f1' : entry.pass_percentage >= 40 ? '#f59e0b' : '#f43f5e'} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : chartType === 'line' ? (
                  <LineChart data={subjectStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="subject_code"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                      formatter={(value: any) => [`${value}%`, 'Pass Rate']}
                    />
                    <Line type="monotone" dataKey="pass_percentage" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 5 }} activeDot={{ r: 7 }} />
                  </LineChart>
                ) : chartType === 'area' ? (
                  <AreaChart data={subjectStats}>
                    <defs>
                      <linearGradient id="colorPass" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="subject_code"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                      formatter={(value: any) => [`${value}%`, 'Pass Rate']}
                    />
                    <Area type="monotone" dataKey="pass_percentage" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorPass)" />
                  </AreaChart>
                ) : chartType === 'radar' ? (
                  <RadarChart data={subjectStats}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject_code" tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fontWeight: 600, fill: '#94a3b8' }} />
                    <Radar name="Pass %" dataKey="pass_percentage" stroke="#6366f1" fill="#6366f1" fillOpacity={0.6} />
                    <Tooltip formatter={(value: any) => `${value}%`} />
                  </RadarChart>
                ) : chartType === 'radial' ? (
                  <RadialBarChart
                    innerRadius="10%"
                    outerRadius="90%"
                    data={subjectStats.map((s, i) => ({ ...s, fill: `hsl(${(i * 360) / subjectStats.length}, 70%, 60%)` }))}
                    startAngle={180}
                    endAngle={0}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                    <RadialBar
                      background
                      dataKey="pass_percentage"
                      cornerRadius={10}
                      label={{ position: 'insideStart', fill: '#fff', fontSize: 10, fontWeight: 'bold', formatter: (v: any) => `${v}%` }}
                    />
                    <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" formatter={(value, entry: any) => entry.payload.subject_code} />
                    <Tooltip formatter={(value: any) => `${value}%`} />
                  </RadialBarChart>
                ) : (
                  <PieChart>
                    <Pie
                      data={subjectStats}
                      dataKey="pass_percentage"
                      nameKey="subject_code"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ subject_code, pass_percentage }) => `${subject_code}: ${pass_percentage.toFixed(1)}%`}
                      labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                    >
                      {subjectStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(${(index * 360) / subjectStats.length}, 70%, 60%)`} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `${value}%`} />
                  </PieChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl text-slate-400">
                <AlertTriangle size={32} className="mb-2 opacity-20" />
                <p className="font-bold">No Subject Stats Available</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card rounded-[2.5rem] p-8 min-h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-900">Average Performance Trend</h3>
            <select
              value={trendChartType}
              onChange={(e) => setTrendChartType(e.target.value as 'area' | 'line' | 'bar')}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="area">📉 Area Chart</option>
              <option value="line">📈 Line Chart</option>
              <option value="bar">📊 Bar Chart</option>
            </select>
          </div>
          <div className="h-[300px] flex-1">
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center bg-slate-50/50 rounded-2xl animate-pulse">
                <TrendingUp size={32} className="text-slate-200" />
              </div>
            ) : subjectStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {trendChartType === 'area' ? (
                  <AreaChart data={subjectStats}>
                    <defs>
                      <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="subject_code"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                    <Area type="monotone" dataKey="avg_total" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorAvg)" />
                  </AreaChart>
                ) : trendChartType === 'line' ? (
                  <LineChart data={subjectStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="subject_code"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                    <Line type="monotone" dataKey="avg_total" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 5 }} activeDot={{ r: 7 }} />
                  </LineChart>
                ) : (
                  <BarChart data={subjectStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="subject_code"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                    <Bar dataKey="avg_total" fill="#10b981" radius={[8, 8, 0, 0]} barSize={40} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl text-slate-400">
                <AlertTriangle size={32} className="mb-2 opacity-20" />
                <p className="font-bold">No Trend Data Available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card rounded-[2.5rem] overflow-hidden min-h-[400px]">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white">
            <h3 className="text-xl font-bold text-slate-900">Top Performers - Semester {semester}</h3>
            <Award size={24} className="text-amber-500" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <th className="px-8 py-4">Rank</th>
                  <th className="px-8 py-4">Student</th>
                  <th className="px-8 py-4">SGPA</th>
                  <th className="px-8 py-4">Relative</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  [1, 2, 3, 4].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={4} className="px-8 py-6"><div className="h-4 bg-slate-100 rounded w-full"></div></td>
                    </tr>
                  ))
                ) : topPerformers.length > 0 ? (
                  topPerformers.map((p, idx) => (
                    <tr key={p.usn} className="hover:bg-slate-50 transition-colors">
                      <td className="px-8 py-5">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-amber-100 text-amber-700' :
                          idx === 1 ? 'bg-slate-200 text-slate-700' :
                            idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-400'
                          }`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <p className="font-bold text-slate-900 leading-tight">{p.student_name}</p>
                        <p className="text-xs text-slate-400 mt-1">{p.usn}</p>
                      </td>
                      <td className="px-8 py-5 font-bold text-slate-700">
                        {(p.sgpa ?? 0).toFixed(2)}
                        <span className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">/ 10</span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-full max-w-[60px] bg-slate-100 h-1.5 rounded-full">
                            <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${p.percentage ?? 0}%` }}></div>
                          </div>
                          <span className="text-xs font-black text-slate-900">{p.percentage ?? 0}%</span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center">
                      <p className="text-slate-400 font-bold italic">No ranking data for this semester.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card rounded-[2.5rem] p-8 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-slate-900">Failure Analysis</h3>
            <AlertOctagon size={24} className="text-rose-500" />
          </div>

          {isLoading ? (
            <div className="flex-1 flex flex-col gap-6">
              <div className="h-32 bg-slate-50 rounded-3xl animate-pulse"></div>
              <div className="space-y-4">
                <div className="h-4 bg-slate-50 rounded w-full animate-pulse"></div>
                <div className="h-4 bg-slate-50 rounded w-3/4 animate-pulse"></div>
                <div className="h-4 bg-slate-50 rounded w-1/2 animate-pulse"></div>
              </div>
            </div>
          ) : failureAnalysis ? (
            <div className="space-y-8 flex-1">
              <div className="bg-rose-50 p-6 rounded-[2rem] text-center border border-rose-100">
                <p className="text-sm font-bold text-rose-600 uppercase tracking-widest mb-1">Semester Fail Rate</p>
                <p className="text-5xl font-black text-rose-700">{(failureAnalysis.failure_rate ?? 0).toFixed(1)}%</p>
                <p className="text-xs text-rose-400 mt-2">{failureAnalysis.total_failures ?? 0} students failed in one or more subjects</p>
              </div>

              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Critically Failed Subjects</h4>
                <div className="space-y-4">
                  {failureAnalysis.subject_wise_failures.length > 0 ? (
                    failureAnalysis.subject_wise_failures.slice(0, 5).map((f) => (
                      <div key={f.subject_code} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                          <span className="text-sm font-bold text-slate-700">{f.subject_code}</span>
                        </div>
                        <span className="text-sm font-black text-slate-900">{f.count} students</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400 italic">No subject-wise failures recorded.</p>
                  )}
                </div>
              </div>

              <div className="mt-auto pt-6 border-t border-slate-100">
                <p className="text-xs text-slate-400 leading-relaxed italic">
                  Subjects with fail rates above 25% are flagged for faculty review automatically.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <AlertTriangle size={32} className="mb-2 opacity-20" />
              <p className="font-bold text-center px-4">Analysis Unavailable</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
