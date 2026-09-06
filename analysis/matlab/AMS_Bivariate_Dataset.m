clc
clear

%% ---------------------------------------------------------
% 1. Add SFE-IFC toolbox
% ----------------------------------------------------------

addpath(genpath( ...
'C:\Users\soura\SFE_IFC-Toolbox-main\SFE_IFC-Toolbox-main' ...
));

%% ---------------------------------------------------------
% 2. Read discharge data
% ----------------------------------------------------------
filename = 'Ukai(1975-2021).xlsx';

% Automatically detect the first sheet
sheet_list = sheetnames(filename);
sheet_name = sheet_list{1};

% Read data from the detected sheet
data = readmatrix(filename, 'Sheet', sheet_name);

flowdata = data;

%% ---------------------------------------------------------
% 3. Catchment area (from sheet name)
% ----------------------------------------------------------

area_km = str2double(sheet_name);

%% ---------------------------------------------------------
% 4. Independence interval
%    SFE-IFC formula: floor(5 + log(A / 1.609^2))
%    For A = 62255 km^2 this equals 15 days
% ----------------------------------------------------------

interval = floor(5 + log(area_km/1.609^2));

fprintf('Independence interval = %d days\n',interval);

%% ---------------------------------------------------------
% 5. Extract Annual Maximum Series
% ----------------------------------------------------------

peaks_datenum = AMS_sample_corrected(flowdata);

fprintf('\nNumber of AMS events = %d\n', ...
    size(peaks_datenum,1));

%% ---------------------------------------------------------
% 6. Determine start and end of each flood event
%    Using toolbox starenddate procedure
% ----------------------------------------------------------

[s_e_date_q,dura,f_low] = ...
    starenddate(flowdata,peaks_datenum,interval);

%% ---------------------------------------------------------
% 7. Extract OLD flood characteristics
%    DO NOT use FloodCharacteristics.m
%    DO NOT use recession-curve correction
% ----------------------------------------------------------

[oldflood_p,oldflood_f,T_AMS] = ...
    oldfloodevents( ...
        flowdata, ...
        s_e_date_q(:,[1 2 3 5 6 7]), ...
        dura(:,1) ...
    );

%% ---------------------------------------------------------
% 8. Display results
% ----------------------------------------------------------

fprintf('\n============================================\n');
fprintf('AMS FLOOD CHARACTERISTICS\n');
fprintf('============================================\n');

disp(T_AMS);

%% ---------------------------------------------------------
% 9. Save final AMS P-V-D dataset
% ----------------------------------------------------------

writetable(T_AMS, ...
    'C:\RapidsProjects\Btp\data\processed\AMS_PVD_final_dataset.xlsx');

fprintf('\nAMS P-V-D dataset saved successfully.\n');
fprintf('Path: C:\\RapidsProjects\\Btp\\data\\processed\\AMS_PVD_dataset.xlsx\n');
