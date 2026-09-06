%% ============================================================
%  AMS DATASET EXTRACTION
%  Annual Maximum Series
%  ============================================================

clear;
clc;

%% 1. Read original discharge data

data = readtable('Ukai(1975-2021).xlsx', ...
    'VariableNamingRule', 'preserve');

%% 2. Create Date column

Date = datetime(data.Year, data.Month, data.Day);

%% 3. Create a temporary table

temp = table(Date, data.("Q(m3/s)"), ...
    'VariableNames', {'Date', 'Discharge'});

%% 4. Add Year for grouping

temp.Year = year(temp.Date);

%% 5. Find annual maximum discharge

[G, Year] = findgroups(temp.Year);

Peak = splitapply(@max, temp.Discharge, G);

%% 6. Find the date corresponding to each annual maximum

AMS_Date = NaT(length(Peak), 1);

for i = 1:length(Peak)
    idx = temp.Year == Year(i) & temp.Discharge == Peak(i);
    AMS_Date(i) = temp.Date(find(idx, 1));
end

%% 7. Create final AMS dataset
% Only retain Date and Peak Discharge

AMS = table(AMS_Date, Peak, ...
    'VariableNames', {'Date', 'Peak'});

%% 8. Sort chronologically

AMS = sortrows(AMS, 'Date');

%% 9. Display result

disp(AMS);

fprintf('\nNumber of AMS events = %d\n', height(AMS));

%% 10. Save processed AMS dataset

writetable(AMS, ...
    'C:\RapidsProjects\Btp\data\processed\AMS_Univariate_Dataset.xlsx');

fprintf('\nAMS dataset saved as AMS_Univariate_Dataset.xlsx\n');